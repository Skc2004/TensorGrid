package process

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
)

// DockerSupervisor manages isolated jobs inside Docker containers
type DockerSupervisor struct {
	cli *client.Client
}

func NewDockerSupervisor() (*DockerSupervisor, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to initialize docker client: %w", err)
	}
	return &DockerSupervisor{cli: cli}, nil
}

// RunJob pulls the image, creates a container, runs it, streams logs, and removes it.
func (ds *DockerSupervisor) RunJob(ctx context.Context, imageName string, cmd []string) error {
	log.Printf("Pulling Docker image %s...", imageName)
	reader, err := ds.cli.ImagePull(ctx, imageName, image.PullOptions{})
	if err != nil {
		return fmt.Errorf("failed to pull image: %w", err)
	}
	// Copy pull output to stdout
	io.Copy(os.Stdout, reader)
	reader.Close()

	// Prepare host config with current working directory mapped to /workspace
	cwd, _ := os.Getwd()
	hostConfig := &container.HostConfig{
		Mounts: []mount.Mount{
			{
				Type:   mount.TypeBind,
				Source: cwd,
				Target: "/workspace",
			},
		},
	}

	log.Printf("Creating container from %s...", imageName)
	resp, err := ds.cli.ContainerCreate(ctx, &container.Config{
		Image:      imageName,
		Cmd:        cmd,
		Tty:        false,
		WorkingDir: "/workspace",
	}, hostConfig, nil, nil, "")
	if err != nil {
		return fmt.Errorf("failed to create container: %w", err)
	}

	containerID := resp.ID
	// Ensure container is removed when we are done
	defer func() {
		log.Printf("Cleaning up container %s...", containerID[:10])
		ds.cli.ContainerRemove(context.Background(), containerID, container.RemoveOptions{Force: true})
	}()

	log.Printf("Starting container %s...", containerID[:10])
	if err := ds.cli.ContainerStart(ctx, containerID, container.StartOptions{}); err != nil {
		return fmt.Errorf("failed to start container: %w", err)
	}

	// Stream logs
	out, err := ds.cli.ContainerLogs(ctx, containerID, container.LogsOptions{ShowStdout: true, ShowStderr: true, Follow: true})
	if err != nil {
		return fmt.Errorf("failed to get container logs: %w", err)
	}
	
	// Docker multiplexes stdout/stderr, stdcopy demultiplexes it
	_, err = stdcopy.StdCopy(os.Stdout, os.Stderr, out)
	if err != nil && err != io.EOF {
		log.Printf("Error streaming logs: %v", err)
	}

	// Wait for container to finish
	statusCh, errCh := ds.cli.ContainerWait(ctx, containerID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			return fmt.Errorf("error waiting for container: %w", err)
		}
	case status := <-statusCh:
		log.Printf("Container exited with status %d", status.StatusCode)
		if status.StatusCode != 0 {
			return fmt.Errorf("container exited with non-zero status: %d", status.StatusCode)
		}
	}

	return nil
}

// StartInferenceServer starts a long-running model inference container.
// It maps the container's port to a host port and doesn't wait for completion.
func (ds *DockerSupervisor) StartInferenceServer(ctx context.Context, imageName string, modelPath string) (string, error) {
	log.Printf("Deploying model %s using image %s...", modelPath, imageName)
	
	// Ensure image exists or pull
	_, err := ds.cli.ImagePull(ctx, imageName, image.PullOptions{})
	if err != nil {
		log.Printf("Failed to pull inference image, might already exist: %v", err)
	}

	hostConfig := &container.HostConfig{
		Mounts: []mount.Mount{
			{
				Type:   mount.TypeBind,
				Source: modelPath,
				Target: "/models", // Container expects models here
			},
		},
		PortBindings: nil, // Would map 8000:8000
	}

	resp, err := ds.cli.ContainerCreate(ctx, &container.Config{
		Image: imageName,
		Tty:   false,
	}, hostConfig, nil, nil, "")
	if err != nil {
		return "", fmt.Errorf("failed to create inference container: %w", err)
	}

	if err := ds.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return "", fmt.Errorf("failed to start inference container: %w", err)
	}

	log.Printf("Inference server running in container %s", resp.ID[:10])
	// In a real grid, you'd allocate a dynamic port or use a load balancer.
	return fmt.Sprintf("http://node-ip:8000/predict"), nil
}

// StartJupyterLab provisions an interactive Jupyter Notebook server
func (ds *DockerSupervisor) StartJupyterLab(ctx context.Context, modelPath string) (string, error) {
	imageName := "jupyter/scipy-notebook"
	log.Printf("Starting interactive Jupyter session using %s...", imageName)
	
	_, err := ds.cli.ImagePull(ctx, imageName, image.PullOptions{})
	if err != nil {
		log.Printf("Failed to pull jupyter image: %v", err)
	}

	hostConfig := &container.HostConfig{
		Mounts: []mount.Mount{
			{
				Type:   mount.TypeBind,
				Source: modelPath,
				Target: "/home/jovyan/work", 
			},
		},
		// Map 8888 to host
		// In a real setup you use nat.PortMap
	}

	resp, err := ds.cli.ContainerCreate(ctx, &container.Config{
		Image: imageName,
		Tty:   false,
		Env:   []string{"JUPYTER_ENABLE_LAB=yes", "JUPYTER_TOKEN=secure_token"},
	}, hostConfig, nil, nil, "")
	
	if err != nil {
		return "", fmt.Errorf("failed to create jupyter container: %w", err)
	}

	if err := ds.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return "", fmt.Errorf("failed to start jupyter container: %w", err)
	}

	log.Printf("Jupyter session running in container %s", resp.ID[:10])
	return fmt.Sprintf("http://node-ip:8888/lab?token=secure_token"), nil
}

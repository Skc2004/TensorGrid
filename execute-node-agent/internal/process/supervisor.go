package process

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
)

// Supervisor is responsible for running and monitoring the condor_master daemon
type Supervisor struct {
	executable string
}

func NewSupervisor(executable string) *Supervisor {
	return &Supervisor{
		executable: executable,
	}
}

// Start launches the daemon and blocks until it exits or context is cancelled.
// It ensures that when the supervisor is killed, the child process is cleaned up.
func (s *Supervisor) Start(ctx context.Context) error {
	log.Printf("Starting process: %s", s.executable)
	
	// Create the command with the context. If ctx is cancelled, it will kill the process
	cmd := exec.CommandContext(ctx, s.executable, "-f") // -f tells condor_master to stay in foreground
	
	// Forward standard output and error to the supervisor's logs
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	// Set environment variables if needed
	cmd.Env = os.Environ()
	
	log.Println("Process started. Waiting for completion...")
	err := cmd.Run()
	
	if ctx.Err() != nil {
		log.Println("Context cancelled, process terminated by supervisor.")
		return nil
	}
	
	if err != nil {
		return fmt.Errorf("process exited with error: %w", err)
	}
	
	log.Println("Process completed successfully.")
	return nil
}

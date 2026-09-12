# Edge Agent Internals

The Grid Ops Execution Agent is a lightweight daemon written in Go (Golang). Its primary responsibility is to authenticate with the central controller, poll for assigned compute jobs, execute them in secure isolated environments, and report telemetry.

## Directory Structure
`execute-node-agent/`
- `cmd/agent/main.go`: Entry point. Handles OS signal trapping (SIGINT/SIGTERM) and Windows Service registration.
- `internal/auth/`: Handles token provisioning and HTCondor IDTOKEN generation.
- `internal/config/`: Generates local daemon configurations dynamically based on the policy (e.g. `strict-idle`).
- `internal/process/`: The Docker Supervisor. Interfaces with the Docker Engine API.
- `internal/telemetry/`: The Prometheus exporter.

## Process Supervision & Isolation

The agent utilizes the `github.com/docker/docker/client` SDK to ensure all ML workloads are executed safely without risking the host machine.

### Job Execution (`RunJob`)
1. **Pull**: The agent pulls the requested image (e.g. `pytorch/pytorch:latest`).
2. **Mount**: It maps the local workspace directory (where the dataset and scripts are downloaded) to `/workspace` inside the container using a `mount.TypeBind`.
3. **Execute**: The container is started with the specified `Cmd`.
4. **Log Streaming**: Standard Output and Error are demultiplexed using `stdcopy.StdCopy` and forwarded to the central server via an HTTP POST.
5. **Cleanup**: Regardless of exit status, a `defer` block ensures the container is force-removed, leaving no state behind on the host.

### Long-Running Services (`StartInferenceServer` & `StartJupyterLab`)
Unlike batch jobs, inference servers and Jupyter notebooks require persistent uptime and port mapping. The supervisor maps internal container ports (8000, 8888) to the host using `container.HostConfig.PortBindings`, allowing the central FastAPI ingress to proxy traffic directly to the container.

## Telemetry Export

The agent runs a secondary goroutine hosting an HTTP server on `:9090` using the `github.com/prometheus/client_golang/prometheus/promhttp` package.

It registers three primary `Gauge` metrics:
- `node_cpu_usage_percent`
- `node_ram_usage_bytes`
- `node_gpu_temperature_celsius`

These are scraped periodically by the central Prometheus instance.

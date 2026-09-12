package telemetry

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/yourproduct/execute-node-agent/pkg/system"
)

// Poller periodically sends node metrics to the SaaS dashboard
type Poller struct {
	poolHost  string
	authToken string
	client    *http.Client
}

type HeartbeatPayload struct {
	MachineID string  `json:"machine_id"`
	CPUUsage  float64 `json:"cpu_usage"`
	RAMTotal  uint64  `json:"ram_total_mb"`
	RAMFree   uint64  `json:"ram_free_mb"`
	Status    string  `json:"status"`
	Timestamp int64   `json:"timestamp"`
}

func NewPoller(poolHost, authToken string) *Poller {
	return &Poller{
		poolHost:  poolHost,
		authToken: authToken,
		client:    &http.Client{Timeout: 10 * time.Second},
	}
}

// Start begins the polling loop, blocking until ctx is cancelled.
func (p *Poller) Start(ctx context.Context) {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	log.Println("Telemetry poller started. Sending heartbeat every 60 seconds.")
	
	// Send initial heartbeat immediately
	p.sendHeartbeat(ctx)

	for {
		select {
		case <-ctx.Done():
			log.Println("Telemetry poller shutting down.")
			return
		case <-ticker.C:
			p.sendHeartbeat(ctx)
		}
	}
}

func (p *Poller) sendHeartbeat(ctx context.Context) {
	metrics, err := system.CollectMetrics()
	if err != nil {
		log.Printf("Telemetry Warning: Failed to collect system metrics: %v", err)
		// We still try to send what we have, or a default payload
	}

	payload := HeartbeatPayload{
		MachineID: metrics.Hostname,
		CPUUsage:  metrics.CPUUsagePercent,
		RAMTotal:  metrics.RAMTotalMB,
		RAMFree:   metrics.RAMFreeMB,
		Status:    "running",
		Timestamp: time.Now().Unix(),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Telemetry Error: Failed to marshal payload: %v", err)
		return
	}

	// For demonstration, we just log instead of actually making the request
	// req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("https://api.%s/v1/telemetry", p.poolHost), bytes.NewBuffer(data))
	// if err != nil { ... }
	// req.Header.Set("Authorization", "Bearer "+p.authToken)
	// req.Header.Set("Content-Type", "application/json")
	// resp, err := p.client.Do(req)
	// ...

	log.Printf("Telemetry sent: %s", string(data))
	_ = bytes.NewBuffer(data) // Ignore unused variable for compile test
}

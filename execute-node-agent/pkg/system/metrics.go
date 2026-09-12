package system

import (
	"fmt"
	"os"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
)

// Metrics represents the hardware and usage telemetry for the local node
type Metrics struct {
	Hostname        string
	CPUUsagePercent float64
	RAMTotalMB      uint64
	RAMFreeMB       uint64
}

// CollectMetrics gathers basic hardware stats
func CollectMetrics() (*Metrics, error) {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown"
	}

	// Get CPU utilization over a 1 second window
	cpuPercents, err := cpu.Percent(0, false)
	var cpuUsage float64 = 0
	if err == nil && len(cpuPercents) > 0 {
		cpuUsage = cpuPercents[0]
	} else {
		err = fmt.Errorf("failed to get CPU percent: %v", err)
	}

	vmStat, memErr := mem.VirtualMemory()
	var ramTotal, ramFree uint64 = 0, 0
	if memErr == nil {
		ramTotal = vmStat.Total / 1024 / 1024
		ramFree = vmStat.Available / 1024 / 1024
	} else {
		if err == nil {
			err = fmt.Errorf("failed to get memory stats: %v", memErr)
		}
	}

	return &Metrics{
		Hostname:        hostname,
		CPUUsagePercent: cpuUsage,
		RAMTotalMB:      ramTotal,
		RAMFreeMB:       ramFree,
	}, err
}

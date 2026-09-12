package telemetry

import (
	"log"
	"math/rand"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	cpuUsage = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "node_cpu_usage_percent",
		Help: "Current CPU usage percentage of the edge node.",
	})
	ramUsage = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "node_ram_usage_bytes",
		Help: "Current RAM usage in bytes.",
	})
	gpuTemp = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "node_gpu_temperature_celsius",
		Help: "Current GPU temperature in Celsius.",
	})
)

func init() {
	prometheus.MustRegister(cpuUsage)
	prometheus.MustRegister(ramUsage)
	prometheus.MustRegister(gpuTemp)
}

// StartMetricsServer starts an HTTP server for Prometheus to scrape on port 9090
func StartMetricsServer() {
	go func() {
		// Simulate dynamic hardware metrics for demonstration
		for {
			cpuUsage.Set(rand.Float64() * 100)
			ramUsage.Set(rand.Float64() * 16 * 1024 * 1024 * 1024) // Up to 16GB
			gpuTemp.Set(40.0 + rand.Float64()*40) // 40-80 C
			time.Sleep(5 * time.Second)
		}
	}()

	http.Handle("/metrics", promhttp.Handler())
	log.Println("Starting Prometheus metrics server on :9090")
	if err := http.ListenAndServe(":9090", nil); err != nil {
		log.Fatalf("Metrics server failed: %v", err)
	}
}

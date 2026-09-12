package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"
	"golang.org/x/sys/windows/svc"

	"github.com/yourproduct/execute-node-agent/internal/auth"
	"github.com/yourproduct/execute-node-agent/internal/condor"
	"github.com/yourproduct/execute-node-agent/internal/config"
	"github.com/yourproduct/execute-node-agent/internal/process"
	"github.com/yourproduct/execute-node-agent/internal/telemetry"
)

var (
	poolHost   string
	authToken  string
	policyName string
)

const serviceName = "HTCondorGridAgent"

type agentService struct{}

func (m *agentService) Execute(args []string, r <-chan svc.ChangeRequest, changes chan<- svc.Status) (ssec bool, errno uint32) {
	const cmdsAccepted = svc.AcceptStop | svc.AcceptShutdown
	changes <- svc.Status{State: svc.StartPending}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan struct{})
	go func() {
		runAgentLogic(ctx)
		close(done)
	}()

	changes <- svc.Status{State: svc.Running, Accepts: cmdsAccepted}

loop:
	for {
		select {
		case c := <-r:
			switch c.Cmd {
			case svc.Interrogate:
				changes <- c.CurrentStatus
			case svc.Stop, svc.Shutdown:
				log.Println("Service stop requested...")
				changes <- svc.Status{State: svc.StopPending}
				cancel()
				break loop
			}
		case <-done:
			break loop
		}
	}
	changes <- svc.Status{State: svc.Stopped}
	return
}

func main() {
	var rootCmd = &cobra.Command{
		Use:   "execute-node-agent",
		Short: "HTCondor Execute Node Agent for SaaS grid integration",
		Long:  `A lightweight agent that provisions, configures, and monitors HTCondor for cycle-scavenging labs.`,
		Run: func(cmd *cobra.Command, args []string) {
			isInteractive, err := svc.IsAnInteractiveSession()
			if err != nil {
				log.Fatalf("Failed to determine if interactive session: %v", err)
			}

			if !isInteractive {
				log.Println("Starting as Windows Service...")
				err = svc.Run(serviceName, &agentService{})
				if err != nil {
					log.Fatalf("Service failed: %v", err)
				}
			} else {
				log.Println("Starting in interactive console mode...")
				ctx, cancel := context.WithCancel(context.Background())
				defer cancel()

				sigs := make(chan os.Signal, 1)
				signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
				go func() {
					sig := <-sigs
					log.Printf("Received signal: %s, initiating graceful shutdown...", sig)
					cancel()
				}()

				runAgentLogic(ctx)
			}
		},
	}

	rootCmd.Flags().StringVar(&poolHost, "pool", "central.yourproduct.com", "The HTCondor central manager host")
	rootCmd.Flags().StringVar(&authToken, "token", "", "Institution authentication token (Required)")
	rootCmd.Flags().StringVar(&policyName, "policy", "strict-idle", "Cycle-scavenging policy")
	rootCmd.MarkFlagRequired("token")

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func runAgentLogic(ctx context.Context) {
	// Start Prometheus Telemetry
	go telemetry.StartMetricsServer()

	log.Println("Starting HTCondor Execute Node Agent Logic...")
	log.Printf("Target Pool: %s | Policy: %s", poolHost, policyName)

	log.Println("[Step 1] Authenticating and provisioning IDTOKEN...")
	authManager := auth.NewManager(poolHost)
	err := authManager.ProvisionToken(ctx, authToken)
	if err != nil {
		log.Fatalf("Failed to provision IDTOKEN: %v", err)
	}

	log.Println("[Step 2] Verifying HTCondor binaries...")
	condorManager := condor.NewManager("condor_install_dir")
	err = condorManager.EnsureBinaries(ctx)
	if err != nil {
		log.Fatalf("Failed to download or verify HTCondor binaries: %v", err)
	}

	log.Println("[Step 3] Generating HTCondor configuration...")
	configGen := config.NewGenerator(poolHost, policyName, "condor_install_dir")
	err = configGen.Generate()
	if err != nil {
		log.Fatalf("Failed to generate HTCondor configuration: %v", err)
	}

	log.Println("[Step 4] Starting telemetry poller...")
	telemetryPoller := telemetry.NewPoller(poolHost, authToken)
	go telemetryPoller.Start(ctx)

	log.Println("[Step 5] Launching condor_master...")
	supervisor := process.NewSupervisor("condor_install_dir/bin/condor_master")
	
	if err := supervisor.Start(ctx); err != nil {
		log.Fatalf("Supervisor exited with error: %v", err)
	}

	log.Println("Agent logic execution complete.")
}

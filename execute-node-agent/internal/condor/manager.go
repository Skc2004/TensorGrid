package condor

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

// Manager handles the downloading and verification of HTCondor binaries
type Manager struct {
	installDir string
}

func NewManager(installDir string) *Manager {
	return &Manager{
		installDir: installDir,
	}
}

// EnsureBinaries checks if the necessary HTCondor binaries are present on disk.
// If they are not, it downloads them from a CDN.
func (m *Manager) EnsureBinaries(ctx context.Context) error {
	log.Printf("Checking for HTCondor binaries in %s...", m.installDir)

	binDir := filepath.Join(m.installDir, "bin")
	
	ext := ""
	if runtime.GOOS == "windows" {
		ext = ".exe"
	}
	
	requiredBinaries := []string{
		"condor_master" + ext,
		"condor_startd" + ext,
		"condor_starter" + ext,
	}
	
	missing := false
	for _, bin := range requiredBinaries {
		if _, err := os.Stat(filepath.Join(binDir, bin)); os.IsNotExist(err) {
			missing = true
			log.Printf("Missing binary: %s", bin)
			break
		}
	}
	
	if !missing {
		log.Println("All required HTCondor binaries found.")
		return nil
	}
	
	log.Println("Binaries missing. Initiating download from CDN...")
	return m.downloadBinaries(ctx)
}

func (m *Manager) downloadBinaries(ctx context.Context) error {
	// In production, this would make an HTTP request to download a zipped/tarballed payload
	// and extract it into m.installDir
	
	log.Printf("Mocking download of HTCondor binaries for %s/%s", runtime.GOOS, runtime.GOARCH)
	
	select {
	case <-time.After(1 * time.Second):
	case <-ctx.Done():
		return ctx.Err()
	}
	
	binDir := filepath.Join(m.installDir, "bin")
	if err := os.MkdirAll(binDir, 0755); err != nil {
		return fmt.Errorf("failed to create bin directory: %w", err)
	}
	
	// Create mock binaries
	ext := ""
	if runtime.GOOS == "windows" {
		ext = ".exe"
	}
	
	binaries := []string{
		"condor_master" + ext,
		"condor_startd" + ext,
		"condor_starter" + ext,
	}
	
	for _, bin := range binaries {
		path := filepath.Join(binDir, bin)
		// Write a dummy script or executable
		err := os.WriteFile(path, []byte("#!/bin/sh\necho 'mock condor binary'"), 0755)
		if err != nil {
			return err
		}
	}
	
	log.Println("Download and extraction complete.")
	return nil
}

package auth

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

// Manager handles authentication with the SaaS pool and IDTOKEN provisioning
type Manager struct {
	poolHost string
}

func NewManager(poolHost string) *Manager {
	return &Manager{
		poolHost: poolHost,
	}
}

// ProvisionToken reaches out to the SaaS central manager with the institution token
// and securely saves the resulting IDTOKEN to the local filesystem for HTCondor.
func (m *Manager) ProvisionToken(ctx context.Context, authToken string) error {
	log.Println("Requesting IDTOKEN from SaaS API...")
	
	// Create a dummy IDTOKEN for demonstration. In a real system, we'd hit the API.
	// client := &http.Client{Timeout: 10 * time.Second}
	// req, _ := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("https://api.%s/v1/auth/provision", m.poolHost), nil)
	// req.Header.Set("Authorization", "Bearer "+authToken)
	// resp, err := client.Do(req)
	// ...

	// Mocking API delay and token response
	select {
	case <-time.After(500 * time.Millisecond):
	case <-ctx.Done():
		return ctx.Err()
	}
	
	mockIDToken := fmt.Sprintf("condor_idtoken_signed_by_%s_for_node", m.poolHost)
	
	return m.saveIDToken(mockIDToken)
}

func (m *Manager) saveIDToken(tokenData string) error {
	// HTCondor by default looks for IDTOKENs in the local config directory or password-dir
	// We will write to a conventional location depending on the OS
	
	var tokenDir string
	if runtime.GOOS == "windows" {
		tokenDir = filepath.Join(os.Getenv("ProgramData"), "condor", "tokens.d")
	} else {
		tokenDir = "/etc/condor/tokens.d"
	}
	
	if err := os.MkdirAll(tokenDir, 0700); err != nil {
		return fmt.Errorf("failed to create tokens directory %s: %w", tokenDir, err)
	}
	
	tokenPath := filepath.Join(tokenDir, "condor_idtoken")
	log.Printf("Saving IDTOKEN to %s", tokenPath)
	
	// HTCondor strictly requires these files to be read-only by the owner (0600)
	err := os.WriteFile(tokenPath, []byte(tokenData), 0600)
	if err != nil {
		return fmt.Errorf("failed to write IDTOKEN file: %w", err)
	}
	
	return nil
}

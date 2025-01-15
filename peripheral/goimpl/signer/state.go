package signer

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

type VoteRecord struct {
	Height   int64  `json:"height"`
	SignHash []byte `json:"sign_hash"`
	TxHash   string `json:"tx_hash"`
}

type State struct {
	path string

	mu sync.Mutex

	data []VoteRecord
}

// _sync will write State on to disk if it's loaded from disk.
func (s *State) _sync() error {
	if s.path == "" {
		return nil
	}

	tmpPath := s.path + ".tmp"

	err := os.RemoveAll(tmpPath)
	if err != nil {
		return fmt.Errorf("ensure no tmp file: %w", err)
	}

	tmpFile, err := os.OpenFile(tmpPath, os.O_WRONLY|os.O_CREATE, 0666)
	if err != nil {
		return fmt.Errorf("open file: %w", err)
	}
	defer tmpFile.Close()

	err = json.NewEncoder(tmpFile).Encode(s.data)
	if err != nil {
		return fmt.Errorf("write state to file: %w", err)
	}

	err = tmpFile.Sync()
	if err != nil {
		return fmt.Errorf("file sync: %w", err)
	}

	err = os.Rename(tmpPath, s.path)
	if err != nil {
		return fmt.Errorf("")
	}

	return err
}

func (s *State) VoteReward(height int64, signHash []byte, txHash string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.data = append(s.data, VoteRecord{
		Height:   height,
		SignHash: signHash,
		TxHash:   txHash,
	})

	return s._sync()
}

// LoadStateFromFile load the state from a file.
func LoadStateFromFile(stateFile string) (*State, error) {
	s := &State{
		path: stateFile,
	}

	data, err := os.ReadFile(stateFile)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(data, s)
	if err != nil {
		return nil, err
	}

	return s, nil
}

func NewMemState() *State {
	return &State{}
}

func NewTmpState() *State {
	return &State{
		path: "/tmp/uploadState.json",
	}
}

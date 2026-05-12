package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

const (
	StatusTersedia  = "Tersedia"
	StatusProsesJual = "Proses Jual"

	MSP_ORG1 = "Org1MSP" 
	MSP_ORG2 = "Org2MSP" 
)

type SmartContract struct {
	contractapi.Contract
}

type SertifikatTanah struct {
	ID           string          `json:"ID"`
	Pemilik      string          `json:"Pemilik"`      
	Lokasi       string          `json:"Lokasi"`
	Luas         int             `json:"Luas"`
	Status       string          `json:"Status"`
	CalonPembeli string          `json:"CalonPembeli"` 
	Persetujuan  map[string]bool `json:"Persetujuan"`
}

func requireMSP(ctx contractapi.TransactionContextInterface, allowed ...string) error {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("gagal mendapatkan MSP ID: %v", err)
	}
	for _, a := range allowed {
		if mspID == a {
			return nil
		}
	}
	return fmt.Errorf("akses ditolak: MSP %s tidak diizinkan untuk fungsi ini", mspID)
}

func assetExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	data, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, fmt.Errorf("gagal mengecek state %s: %v", id, err)
	}
	return data != nil, nil
}

func validateID(id string) error {
	if strings.TrimSpace(id) == "" {
		return fmt.Errorf("id wajib diisi")
	}
	return nil
}

func validateLokasi(lokasi string) error {
	if strings.TrimSpace(lokasi) == "" {
		return fmt.Errorf("lokasi wajib diisi")
	}
	return nil
}

func validateLuas(luas int) error {
	if luas <= 0 {
		return fmt.Errorf("luas harus lebih dari 0")
	}
	return nil
}

func validateIdentityParam(name, v string) error {
	if strings.TrimSpace(v) == "" {
		return fmt.Errorf("%s wajib diisi (ID digital lengkap)", name)
	}
	return nil
}

func isParticipant(sertifikat *SertifikatTanah, actorID string) bool {
	if sertifikat == nil || strings.TrimSpace(actorID) == "" {
		return false
	}

	if sertifikat.Pemilik == actorID {
		return true
	}

	if sertifikat.CalonPembeli == actorID {
		return true
	}

	if sertifikat.Persetujuan != nil {
		if _, ok := sertifikat.Persetujuan[actorID]; ok {
			return true
		}
	}

	return false
}

// TerbitkanSertifikat:
func (s *SmartContract) TerbitkanSertifikat(ctx contractapi.TransactionContextInterface, id string, lokasi string, luas int) error {

	if err := requireMSP(ctx, MSP_ORG1); err != nil {
		return err
	}

	// Validasi input
	if err := validateID(id); err != nil {
		return err
	}
	if err := validateLokasi(lokasi); err != nil {
		return err
	}
	if err := validateLuas(luas); err != nil {
		return err
	}

	// Anti-overwrite atau sertif double
	exists, err := assetExists(ctx, id)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("sertifikat dengan id %s sudah ada", id)
	}

	pemilikID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("gagal mendapatkan ID klien: %v", err)
	}

	sertifikat := SertifikatTanah{
		ID:           id,
		Pemilik:      pemilikID,
		Lokasi:       lokasi,
		Luas:         luas,
		Status:       StatusTersedia,
		CalonPembeli: "",
		Persetujuan:  make(map[string]bool),
	}

	sertifikatJSON, _ := json.Marshal(sertifikat)
	return ctx.GetStub().PutState(id, sertifikatJSON)
}

// AjukanJualBeli:
// - cuma pemilik yg bisa make ni fungsi
func (s *SmartContract) AjukanJualBeli(ctx contractapi.TransactionContextInterface, id string, calonPembeliID string, notarisID string) error {
	if err := requireMSP(ctx, MSP_ORG1); err != nil {
		return err
	}

	if err := validateID(id); err != nil {
		return err
	}
	if err := validateIdentityParam("calonPembeliID", calonPembeliID); err != nil {
		return err
	}
	if err := validateIdentityParam("notarisID", notarisID); err != nil {
		return err
	}

	sertifikat, err := s.QuerySertifikat(ctx, id)
	if err != nil {
		return err
	}

	invokerID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("gagal mendapatkan ID klien: %v", err)
	}

	if sertifikat.Pemilik != invokerID {
		return fmt.Errorf("hanya pemilik sah yang dapat mengajukan jual beli")
	}
	if sertifikat.Status != StatusTersedia {
		return fmt.Errorf("sertifikat tidak tersedia untuk dijual")
	}

	// Anti bypass multi-signature: 3 pihak harus berbeda
	if calonPembeliID == sertifikat.Pemilik {
		return fmt.Errorf("calon pembeli tidak boleh sama dengan pemilik")
	}
	if notarisID == sertifikat.Pemilik {
		return fmt.Errorf("notaris tidak boleh sama dengan pemilik")
	}
	if notarisID == calonPembeliID {
		return fmt.Errorf("notaris tidak boleh sama dengan calon pembeli")
	}

	sertifikat.Status = StatusProsesJual
	sertifikat.CalonPembeli = calonPembeliID
	sertifikat.Persetujuan = map[string]bool{
		sertifikat.Pemilik: false, // Penjual
		calonPembeliID:     false, // Pembeli
		notarisID:          false, // Notaris
	}

	sertifikatJSON, _ := json.Marshal(sertifikat)
	return ctx.GetStub().PutState(id, sertifikatJSON)
}

// SetujuiJualBeli:
// - memastikan hanya pihak di map Persetujuan yang bisa menyetujui
func (s *SmartContract) SetujuiJualBeli(ctx contractapi.TransactionContextInterface, id string) error {
	if err := requireMSP(ctx, MSP_ORG1, MSP_ORG2); err != nil {
		return err
	}

	if err := validateID(id); err != nil {
		return err
	}

	sertifikat, err := s.QuerySertifikat(ctx, id)
	if err != nil {
		return err
	}
	if sertifikat.Status != StatusProsesJual {
		return fmt.Errorf("sertifikat tidak sedang dalam proses jual beli")
	}

	penyetujuID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("gagal mendapatkan ID klien: %v", err)
	}

	if _, ok := sertifikat.Persetujuan[penyetujuID]; !ok {
		return fmt.Errorf("pihak dengan ID ini tidak memiliki wewenang untuk memberikan persetujuan pada transaksi ini")
	}

	sertifikat.Persetujuan[penyetujuID] = true

	// cek semua setuju
	semuaSetuju := true
	for _, status := range sertifikat.Persetujuan {
		if !status {
			semuaSetuju = false
			break
		}
	}

	if semuaSetuju {
		sertifikat.Pemilik = sertifikat.CalonPembeli
		sertifikat.CalonPembeli = ""
		sertifikat.Status = StatusTersedia
		sertifikat.Persetujuan = make(map[string]bool)
	}

	sertifikatJSON, _ := json.Marshal(sertifikat)
	return ctx.GetStub().PutState(id, sertifikatJSON)
}

// BatalkanJualBeli:
// - hanya jika Status == "Proses Jual"
// - reset state supaya bisa dijual kembali
func (s *SmartContract) BatalkanJualBeli(ctx contractapi.TransactionContextInterface, id string) error {
	if err := requireMSP(ctx, MSP_ORG1, MSP_ORG2); err != nil {
		return err
	}
	if err := validateID(id); err != nil {
		return err
	}

	sertifikat, err := s.QuerySertifikat(ctx, id)
	if err != nil {
		return err
	}
	if sertifikat.Status != StatusProsesJual {
		return fmt.Errorf("transaksi tidak dapat dibatalkan karena sertifikat tidak sedang dalam proses jual beli")
	}

	invokerID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("gagal mendapatkan ID klien: %v", err)
	}

	if !isParticipant(sertifikat, invokerID) {
		return fmt.Errorf("hanya pihak yang terlibat dalam transaksi yang dapat membatalkan proses jual beli")
	}

	sertifikat.Status = StatusTersedia
	sertifikat.CalonPembeli = ""
	sertifikat.Persetujuan = make(map[string]bool)

	sertifikatJSON, _ := json.Marshal(sertifikat)
	return ctx.GetStub().PutState(id, sertifikatJSON)
}

// QuerySertifikat: read state by ID
func (s *SmartContract) QuerySertifikat(ctx contractapi.TransactionContextInterface, id string) (*SertifikatTanah, error) {
	if err := validateID(id); err != nil {
		return nil, err
	}

	sertifikatJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, err
	}
	if sertifikatJSON == nil {
		return nil, fmt.Errorf("sertifikat %s tidak ditemukan", id)
	}

	var sertifikat SertifikatTanah
	if err := json.Unmarshal(sertifikatJSON, &sertifikat); err != nil {
		return nil, err
	}
	return &sertifikat, nil
}

// GetSertifikatByOwner mengembalikan daftar sertifikat yang dimiliki oleh aktor aktif.
// Fungsi ini digunakan di Iterasi 3 buat menampilkan data ledger pada panel My Assets.
func (s *SmartContract) GetSertifikatByOwner(ctx contractapi.TransactionContextInterface) ([]*SertifikatTanah, error) {
	invokerID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return nil, fmt.Errorf("gagal mendapatkan ID klien: %v", err)
	}

	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("gagal mengambil data ledger: %v", err)
	}
	defer resultsIterator.Close()

	var sertifikatList []*SertifikatTanah

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var sertifikat SertifikatTanah
		if err := json.Unmarshal(queryResponse.Value, &sertifikat); err != nil {
			continue
		}

		if sertifikat.Pemilik == invokerID {
			sertifikatList = append(sertifikatList, &sertifikat)
		}
	}

	return sertifikatList, nil
}

// GetTransaksiByActor mengembalikan daftar transaksi jual-beli aktif
// yang melibatkan aktor aktif sebagai penjual, pembeli, atau notaris.
// Fungsi ini digunakan di Iterasi 3 buat menampilkan Action & Validation.
func (s *SmartContract) GetTransaksiByActor(ctx contractapi.TransactionContextInterface) ([]*SertifikatTanah, error) {
	invokerID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return nil, fmt.Errorf("gagal mendapatkan ID klien: %v", err)
	}

	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("gagal mengambil data ledger: %v", err)
	}
	defer resultsIterator.Close()

	var transaksiList []*SertifikatTanah

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var sertifikat SertifikatTanah
		if err := json.Unmarshal(queryResponse.Value, &sertifikat); err != nil {
			continue
		}

		if sertifikat.Status != StatusProsesJual {
			continue
		}

		if isParticipant(&sertifikat, invokerID) {
			transaksiList = append(transaksiList, &sertifikat)
		}
	}

	return transaksiList, nil
}

// GetMyID: debug helper untuk ambil ID digital pemanggil (dipakai untuk isi calonPembeliID/notarisID)
func (s *SmartContract) GetMyID(ctx contractapi.TransactionContextInterface) (string, error) {
	id, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("gagal mendapatkan ID klien: %v", err)
	}
	return id, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Error creating chaincode: %v", err)
	}
	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting chaincode: %v", err)
	}
}

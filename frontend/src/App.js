import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API = process.env.REACT_APP_API_URL || '';

function App() {

  const [nama, setNama] = useState("");
  const [jenisSurat, setJenisSurat] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const [namaPengadu, setNamaPengadu] = useState("");
  const [laporan, setLaporan] = useState("");

  const [suratList, setSuratList] = useState([]);
  const [pengaduanList, setPengaduanList] = useState([]);

  const loadData = async () => {

    const surat = await axios.get(`${API}/api/surat`);
    setSuratList(surat.data);

    const pengaduan = await axios.get(`${API}/api/pengaduan`);
    setPengaduanList(pengaduan.data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const submitSurat = async () => {

    await axios.post(`${API}/api/surat`, {
      nama,
      jenis_surat: jenisSurat,
      keterangan
    });

    alert("Pengajuan surat berhasil");

    loadData();
  };

  const submitPengaduan = async () => {

    await axios.post(`${API}/api/pengaduan`, {
      nama: namaPengadu,
      laporan
    });

    alert("Pengaduan berhasil dikirim");

    loadData();
  };

  return (
    <div className="container">

      <h1>Sistem Pelayanan Publik Desa</h1>

      <div className="card">

        <h2>Pengajuan Surat</h2>

        <input
          placeholder="Nama"
          onChange={(e) => setNama(e.target.value)}
        />

        <input
          placeholder="Jenis Surat"
          onChange={(e) => setJenisSurat(e.target.value)}
        />

        <textarea
          placeholder="Keterangan"
          onChange={(e) => setKeterangan(e.target.value)}
        />

        <button onClick={submitSurat}>
          Ajukan Surat
        </button>

      </div>

      <div className="card">

        <h2>Pengaduan Masyarakat</h2>

        <input
          placeholder="Nama"
          onChange={(e) => setNamaPengadu(e.target.value)}
        />

        <textarea
          placeholder="Laporan"
          onChange={(e) => setLaporan(e.target.value)}
        />

        <button onClick={submitPengaduan}>
          Kirim Pengaduan
        </button>

      </div>

      <div className="card">

        <h2>Status Pengajuan Surat</h2>

        {
          suratList.map((item) => (
            <div key={item.id} className="list-item">
              <p><b>{item.nama}</b></p>
              <p>{item.jenis_surat}</p>
              <p>Status: {item.status}</p>
            </div>
          ))
        }

      </div>

      <div className="card">

        <h2>Daftar Pengaduan</h2>

        {
          pengaduanList.map((item) => (
            <div key={item.id} className="list-item">
              <p><b>{item.nama}</b></p>
              <p>{item.laporan}</p>
              <p>Status: {item.status}</p>
            </div>
          ))
        }

      </div>

    </div>
  );
}

export default App;
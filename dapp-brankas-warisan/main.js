import { ethers } from "ethers";
import { CONTRACT_ADDRESS, SEPOLIA_CHAIN_ID } from "./config.js";

// ABI format human-readable ethers v6: 7 fungsi view, 4 fungsi tulis, 4 event.
const ABI = [
  "function pemilik() view returns (address)",
  "function ahliWaris() view returns (address)",
  "function batasDiam() view returns (uint256)",
  "function terakhirAktif() view returns (uint256)",
  "function sudahDiklaim() view returns (bool)",
  "function sisaWaktu() view returns (uint256)",
  "function saldo() view returns (uint256)",
  "function titip() payable",
  "function tarik(uint256 jumlahWei)",
  "function tandaiAktif()",
  "function klaimWarisan()",
  "event DanaDititipkan(address indexed pemilik, uint256 jumlahWei)",
  "event DanaDitarik(address indexed pemilik, uint256 jumlahWei)",
  "event PemilikAktif(address indexed pemilik, uint256 waktu)",
  "event WarisanDiklaim(address indexed ahliWaris, uint256 jumlahWei)",
];

let provider = null;
let signer = null;
let contract = null;
let akun = null;
let alamatPemilik = null;
let alamatAhliWaris = null;
let sisaDetik = 0;
let waktuMuat = 0;
let timerId = null;

const $ = (id) => document.getElementById(id);

function info(pesan, tipe = "info") {
  const kotak = $("status");
  kotak.textContent = pesan;
  kotak.className = `status ${tipe}`;
}

function pesanError(e) {
  if (e?.code === "ACTION_REJECTED") return "user rejected action";
  return e?.reason || e?.shortMessage || e?.message || String(e);
}

function sama(a, b) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

function periksaAlamat() {
  if (!ethers.isAddress(CONTRACT_ADDRESS) || CONTRACT_ADDRESS === ethers.ZeroAddress) {
    throw new Error("CONTRACT_ADDRESS pada config.js belum diisi alamat hasil deploy di Sepolia.");
  }
}

async function periksaJaringan() {
  const net = await provider.getNetwork();
  $("network").textContent = `${net.name} (chainId ${net.chainId})`;
  if (net.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error("MetaMask bukan pada Sepolia (chainId 11155111). Pindahkan jaringan lalu hubungkan ulang.");
  }
}

async function periksaKontrak() {
  const kode = await provider.getCode(CONTRACT_ADDRESS);
  if (kode === "0x") {
    throw new Error("Tidak ada kontrak pada CONTRACT_ADDRESS di jaringan ini.");
  }
}

async function hubungkan() {
  contract = null;
  try {
    if (!window.ethereum) throw new Error("MetaMask tidak ditemukan. Pasang ekstensi MetaMask.");
    periksaAlamat();
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    await periksaJaringan();
    await periksaKontrak();
    signer = await provider.getSigner();
    akun = await signer.getAddress();
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    $("account").textContent = akun;
    info("Dompet terhubung. Membaca data kontrak...");
    await muatData();
  } catch (e) {
    info(`Gagal menghubungkan: ${pesanError(e)}`, "error");
  }
}

function formatDurasi(detik) {
  const d = Number(detik);
  if (d <= 0) return "0 detik";
  const hari = Math.floor(d / 86400);
  const jam = Math.floor((d % 86400) / 3600);
  const menit = Math.floor((d % 3600) / 60);
  const dtk = d % 60;
  const bagian = [];
  if (hari) bagian.push(`${hari} hari`);
  if (jam) bagian.push(`${jam} jam`);
  if (menit) bagian.push(`${menit} menit`);
  if (dtk || bagian.length === 0) bagian.push(`${dtk} detik`);
  return bagian.join(" ");
}

function tampilSisa() {
  const lewat = Math.floor((Date.now() - waktuMuat) / 1000);
  const sisa = Math.max(0, sisaDetik - lewat);
  $("sisaWaktu").textContent =
    sisa > 0
      ? `${formatDurasi(sisa)} (${sisa} detik)`
      : "0 detik (batas diam terlewati, ahli waris dapat klaim)";
}

function perbaruiPeran() {
  let peran = "Pihak lain (tanpa hak)";
  if (sama(akun, alamatPemilik)) peran = "Pemilik dana";
  else if (sama(akun, alamatAhliWaris)) peran = "Ahli waris";
  $("peran").textContent = peran;
}

async function muatData(tampilPesan = true) {
  if (!contract) {
    info("Hubungkan MetaMask terlebih dahulu.", "error");
    return;
  }
  try {
    const [pemilik, ahli, batas, terakhir, diklaim, sisa, saldo] = await Promise.all([
      contract.pemilik(),
      contract.ahliWaris(),
      contract.batasDiam(),
      contract.terakhirAktif(),
      contract.sudahDiklaim(),
      contract.sisaWaktu(),
      contract.saldo(),
    ]);
    alamatPemilik = pemilik;
    alamatAhliWaris = ahli;
    $("pemilik").textContent = pemilik;
    $("ahliWaris").textContent = ahli;
    $("saldo").textContent = `${ethers.formatEther(saldo)} ETH (${saldo} wei)`;
    $("batasDiam").textContent = formatDurasi(batas);
    $("terakhirAktif").textContent = new Date(Number(terakhir) * 1000).toLocaleString("id-ID");
    $("statusKlaim").textContent = diklaim ? "Sudah diklaim (brankas terkunci)" : "Belum diklaim";

    sisaDetik = Number(sisa);
    waktuMuat = Date.now();
    clearInterval(timerId);
    if (diklaim) {
      $("sisaWaktu").textContent = "-";
    } else {
      tampilSisa();
      timerId = setInterval(tampilSisa, 1000);
    }
    perbaruiPeran();
    if (tampilPesan) info("Data berhasil dibaca dari Sepolia.");
  } catch (e) {
    info(`Gagal membaca data: ${pesanError(e)}`, "error");
  }
}

function tombolAktif(aktif) {
  document.querySelectorAll("button").forEach((b) => {
    b.disabled = !aktif;
  });
}

function namaEvent(receipt) {
  for (const log of receipt.logs) {
    try {
      const hasil = contract.interface.parseLog(log);
      if (hasil) return hasil.name;
    } catch {
      // log bukan milik ABI ini, abaikan
    }
  }
  return null;
}

async function kirimTransaksi(nama, kirim) {
  if (!contract) {
    info("Hubungkan MetaMask terlebih dahulu.", "error");
    return;
  }
  tombolAktif(false);
  try {
    info(`Menunggu persetujuan ${nama} di MetaMask...`);
    const tx = await kirim();
    info(`Transaksi dikirim: ${tx.hash}. Menunggu konfirmasi blok...`);
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error("Transaksi tidak berhasil.");
    const ev = namaEvent(receipt);
    await muatData(false);
    info(`Transaksi berhasil! Hash: ${tx.hash}${ev ? ` | Event: ${ev}` : ""}`, "ok");
  } catch (e) {
    info(`Transaksi gagal: ${pesanError(e)}`, "error");
  } finally {
    tombolAktif(true);
  }
}

function bacaEther(idInput) {
  const teks = $(idInput).value.trim();
  if (!teks) throw new Error("Jumlah wajib diisi.");
  const wei = ethers.parseEther(teks);
  if (wei <= 0n) throw new Error("Jumlah harus lebih dari 0.");
  return wei;
}

function titip(e) {
  e.preventDefault();
  try {
    const wei = bacaEther("jumlahTitip");
    kirimTransaksi("titip()", () => contract.titip({ value: wei }));
  } catch (err) {
    info(`Input tidak valid: ${pesanError(err)}`, "error");
  }
}

function tarik(e) {
  e.preventDefault();
  try {
    const wei = bacaEther("jumlahTarik");
    kirimTransaksi("tarik()", () => contract.tarik(wei));
  } catch (err) {
    info(`Input tidak valid: ${pesanError(err)}`, "error");
  }
}

function resetKoneksi(pesan) {
  contract = null;
  signer = null;
  clearInterval(timerId);
  $("account").textContent = "Belum terhubung (hubungkan ulang)";
  $("peran").textContent = "-";
  info(pesan, "error");
}

$("connectBtn").addEventListener("click", hubungkan);
$("refreshBtn").addEventListener("click", () => muatData());
$("formTitip").addEventListener("submit", titip);
$("formTarik").addEventListener("submit", tarik);
$("tandaiBtn").addEventListener("click", () =>
  kirimTransaksi("tandaiAktif()", () => contract.tandaiAktif())
);
$("klaimBtn").addEventListener("click", () =>
  kirimTransaksi("klaimWarisan()", () => contract.klaimWarisan())
);

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => resetKoneksi("Akun berubah. Hubungkan kembali MetaMask."));
  window.ethereum.on("chainChanged", () => {
    $("network").textContent = "-";
    resetKoneksi("Jaringan berubah. Hubungkan kembali MetaMask.");
  });
}

# DApp Brankas Warisan (Tugas 4 Blockchain)

Frontend untuk smart contract BrankasWarisan (Bab 13) di Sepolia.
Stack: HTML, CSS, JavaScript, ethers.js v6, Vite, MetaMask.

## Cara menjalankan
1. Deploy `kontrak/Bab13_BrankasWarisan.sol` lewat Remix (Injected Provider - MetaMask, jaringan Sepolia).
   Parameter constructor: `_ahliWaris` = alamat Account 2, `_batasDiam` = jumlah detik (contoh 180).
2. Buka `config.js`, ganti `CONTRACT_ADDRESS` dengan alamat kontrak hasil deploy.
3. Pastikan Node.js 20.19+ (cek `node -v`), lalu di terminal folder ini:
   ```
   npm install
   npm run dev
   ```
4. Buka http://localhost:5173/ di Chrome yang sudah ada MetaMask (jaringan Sepolia).

Catatan: jangan pernah menaruh private key atau seed phrase di kode.

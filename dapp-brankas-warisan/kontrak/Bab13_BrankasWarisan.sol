// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract BrankasWarisan {
    address public pemilik;
    address public ahliWaris;
    uint256 public batasDiam;
    uint256 public terakhirAktif;
    bool public sudahDiklaim;

    event DanaDititipkan(address indexed pemilik, uint256 jumlahWei);
    event DanaDitarik(address indexed pemilik, uint256 jumlahWei);
    event PemilikAktif(address indexed pemilik, uint256 waktu);
    event WarisanDiklaim(address indexed ahliWaris, uint256 jumlahWei);

    constructor(address _ahliWaris, uint256 _batasDiam) {
        require(_ahliWaris != address(0), "Ahli waris tidak valid");
        require(_ahliWaris != msg.sender, "Ahli waris harus beda dari pemilik");
        require(_batasDiam > 0, "Batas diam harus lebih dari 0");

        pemilik = msg.sender;
        ahliWaris = _ahliWaris;
        batasDiam = _batasDiam;
        terakhirAktif = block.timestamp;
    }

    modifier hanyaPemilik() {
        require(msg.sender == pemilik, "Bukan pemilik");
        _;
    }

    modifier belumDiklaim() {
        require(!sudahDiklaim, "Warisan sudah diklaim");
        _;
    }

    function titip() external payable hanyaPemilik belumDiklaim {
        require(msg.value > 0, "Jumlah harus lebih dari 0");
        terakhirAktif = block.timestamp;
        emit DanaDititipkan(msg.sender, msg.value);
    }

    function tarik(uint256 jumlahWei) external hanyaPemilik belumDiklaim {
        require(
            jumlahWei > 0 && jumlahWei <= address(this).balance,
            "Jumlah tidak valid"
        );
        terakhirAktif = block.timestamp;

        (bool sukses, ) = payable(pemilik).call{value: jumlahWei}("");
        require(sukses, "Gagal menarik dana");

        emit DanaDitarik(msg.sender, jumlahWei);
    }

    function tandaiAktif() external hanyaPemilik belumDiklaim {
        terakhirAktif = block.timestamp;
        emit PemilikAktif(msg.sender, block.timestamp);
    }

    function klaimWarisan() external belumDiklaim {
        require(msg.sender == ahliWaris, "Bukan ahli waris");
        require(
            block.timestamp >= terakhirAktif + batasDiam,
            "Pemilik masih dianggap aktif"
        );

        uint256 jumlah = address(this).balance;
        require(jumlah > 0, "Brankas kosong");

        sudahDiklaim = true;

        (bool sukses, ) = payable(ahliWaris).call{value: jumlah}("");
        require(sukses, "Gagal mengirim warisan");

        emit WarisanDiklaim(ahliWaris, jumlah);
    }

    function sisaWaktu() external view returns (uint256) {
        uint256 batas = terakhirAktif + batasDiam;
        if (block.timestamp >= batas) {
            return 0;
        }
        return batas - block.timestamp;
    }

    function saldo() external view returns (uint256) {
        return address(this).balance;
    }
}

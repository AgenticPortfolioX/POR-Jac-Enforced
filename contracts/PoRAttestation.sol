// contracts/PoRAttestation.sol
// Purpose: ERC-721 NFT recording each PoR-enforced mint event on-chain
// Owner walker/module: Act
// Spec: see PRD §8.3
// Status: IMPLEMENTED — Prompt 4

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PoRAttestation is ERC721, Ownable {
    uint256 private _nextId;

    struct Record {
        uint256 mintedAmount;
        uint256 coverageUsed;
        uint256 priceTime;
        uint256 reserveTime;
        string stampSummary;
    }

    mapping(uint256 => Record) public records;

    event AttestationMinted(
        uint256 indexed tokenId,
        uint256 mintedAmount,
        string stampSummary
    );

    constructor() ERC721("PoR Attestation", "PoRATT") Ownable(msg.sender) {}

    function mintAttestation(
        address to,
        uint256 mintedAmount,
        uint256 coverageUsed,
        uint256 priceTime,
        uint256 reserveTime,
        string calldata stampSummary
    ) external onlyOwner returns (uint256) {
        uint256 id = ++_nextId;
        _safeMint(to, id);
        records[id] = Record(mintedAmount, coverageUsed, priceTime, reserveTime, stampSummary);
        emit AttestationMinted(id, mintedAmount, stampSummary);
        return id;
    }
}

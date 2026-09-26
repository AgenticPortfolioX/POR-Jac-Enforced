// contracts/interfaces/IPoRToken.sol
// Purpose: Interface for PoRToken mint function
// Owner walker/module: Act
// Spec: see PRD §8.2
// Status: IMPLEMENTED — Prompt 4

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPoRToken {
    function mint(address to, uint256 amount, string calldata reason) external;
}

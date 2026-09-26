// SPDX-License-Identifier: MIT
// contracts/interfaces/IPoRToken.sol
// Purpose: Interface specification for PoRToken minting
// Owner walker/module: Act
// Spec: see PRD §8.1
// Status: SCAFFOLD — no logic implemented

pragma solidity ^0.8.20;

interface IPoRToken {
    function mint(address to, uint256 amount, string calldata reason) external;
}

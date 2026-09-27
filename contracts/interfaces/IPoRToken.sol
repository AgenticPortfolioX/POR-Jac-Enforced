// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPoRToken
 * @notice Interface for PoRToken minting capability.
 */
interface IPoRToken {
    function mint(address to, uint256 amount, string calldata reason) external;
}

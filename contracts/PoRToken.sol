// SPDX-License-Identifier: MIT
// contracts/PoRToken.sol
// Purpose: ERC20 Token minted only upon valid Proof of Reserve Stamp
// Owner walker/module: Act
// Spec: see PRD §8.1
// Status: SCAFFOLD — no logic implemented

pragma solidity ^0.8.20;

import "./interfaces/IPoRToken.sol";

contract PoRToken is IPoRToken {
    string public name = "Proof of Reserve Token";
    string public symbol = "PoR";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Minted(address indexed to, uint256 amount, string reason);

    modifier onlyOwner() {
        require(msg.sender == owner, "PoRToken: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: transfer amount exceeds balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "ERC20: transfer amount exceeds balance");
        require(allowance[from][msg.sender] >= amount, "ERC20: insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount, string calldata reason) external override onlyOwner {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
        emit Minted(to, amount, reason);
    }
}

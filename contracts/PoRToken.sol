// contracts/PoRToken.sol
// Purpose: ERC-20 token whose mint is callable only by the Act walker address
// Owner walker/module: Act
// Spec: see PRD §8.2
// Status: IMPLEMENTED — Prompt 4

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PoRToken is ERC20, Ownable {
    address public actWalker;

    event Minted(address indexed to, uint256 amount, string reason);

    modifier onlyAct() {
        require(msg.sender == actWalker, "PoRToken: caller is not Act");
        _;
    }

    constructor(string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        Ownable(msg.sender)
    {}

    function setActWalker(address _walker) external onlyOwner {
        actWalker = _walker;
    }

    function mint(address to, uint256 amount, string calldata reason) external onlyAct {
        _mint(to, amount);
        emit Minted(to, amount, reason);
    }
}

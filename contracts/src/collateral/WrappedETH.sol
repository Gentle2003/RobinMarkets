// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title WrappedETH
 * @notice Canonical WETH9-style wrapper for Robinhood ETH, used as the ERC-20
 *         collateral backing every RobinMarkets outcome. ETH is the native gas
 *         token on Robinhood Chain, but the Conditional Tokens framework needs
 *         an ERC-20, so collateral is held as WETH.
 * @dev On a network with a canonical WETH already deployed, point the protocol
 *      at that instead of deploying this.
 */
contract WrappedETH is ERC20 {
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);

    constructor() ERC20("Wrapped Robinhood ETH", "WETH") { }

    function deposit() public payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) public {
        _burn(msg.sender, wad);
        (bool ok, ) = msg.sender.call{ value: wad }("");
        require(ok, "WETH: ETH transfer failed");
        emit Withdrawal(msg.sender, wad);
    }

    receive() external payable {
        deposit();
    }
}

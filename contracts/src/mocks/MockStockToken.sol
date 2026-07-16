// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @notice A faucet-mintable ERC-20 standing in for a tokenized stock/RWA on the
 *         testnet, where real Robinhood stock tokens may not be available. Anyone
 *         can mint to themselves. Never deploy this to mainnet.
 */
contract MockStockToken is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Faucet: mint test tokens to any address.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

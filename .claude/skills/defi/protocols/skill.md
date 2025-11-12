# DeFi Protocols Integration Skill

```yaml
---
name: defi-protocols
description: Expert knowledge for integrating with major DeFi protocols (Uniswap V2/V3, Aave, Compound, Curve) including swap routing, lending, and liquidity provision
triggers:
  keywords: [uniswap, aave, compound, curve, defi, swap, lending, liquidity, amm]
dependencies: ["evm-expert"]
version: 1.0.0
priority: medium
token_budget: 700
---
```

## Uniswap V3 Integration

### Swap Tokens

```solidity
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract UniswapV3Integration {
    ISwapRouter public constant router = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external returns (uint256 amountOut) {
        // Approve router
        IERC20(tokenIn).approve(address(router), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,              // 3000 = 0.3%, 500 = 0.05%
            recipient: msg.sender,
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,  // Slippage protection
            sqrtPriceLimitX96: 0
        });

        amountOut = router.exactInputSingle(params);
    }
}
```

### Multi-Hop Swaps

```solidity
function swapExactInputMultihop(
    bytes memory path,      // Encoded path: tokenA, fee1, tokenB, fee2, tokenC
    uint256 amountIn,
    uint256 amountOutMinimum
) external returns (uint256 amountOut) {
    ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
        path: path,
        recipient: msg.sender,
        deadline: block.timestamp,
        amountIn: amountIn,
        amountOutMinimum: amountOutMinimum
    });

    amountOut = router.exactInput(params);
}

// Path encoding example
function encodePath() external pure returns (bytes memory) {
    address WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;

    return abi.encodePacked(
        WETH,
        uint24(3000),  // 0.3% fee
        USDC,
        uint24(500),   // 0.05% fee
        DAI
    );
}
```

### Add Liquidity (V3)

```solidity
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

contract LiquidityProvider {
    INonfungiblePositionManager public constant positionManager =
        INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);

    function addLiquidity(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external returns (uint256 tokenId, uint128 liquidity) {
        // Approve tokens
        IERC20(token0).approve(address(positionManager), amount0Desired);
        IERC20(token1).approve(address(positionManager), amount1Desired);

        INonfungiblePositionManager.MintParams memory params =
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: fee,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                recipient: msg.sender,
                deadline: block.timestamp
            });

        (tokenId, liquidity, , ) = positionManager.mint(params);
    }
}
```

---

## Aave V3 Integration

### Supply Assets

```solidity
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AaveIntegration {
    IPool public constant pool = IPool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2);

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) external {
        IERC20(asset).approve(address(pool), amount);

        pool.supply(
            asset,
            amount,
            onBehalfOf,
            0  // referralCode
        );
    }

    function withdraw(
        address asset,
        uint256 amount
    ) external returns (uint256) {
        return pool.withdraw(
            asset,
            amount,
            msg.sender
        );
    }
}
```

### Borrow Assets

```solidity
function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode  // 1 = stable, 2 = variable
) external {
    pool.borrow(
        asset,
        amount,
        interestRateMode,
        0,  // referralCode
        msg.sender
    );
}

function repay(
    address asset,
    uint256 amount,
    uint256 rateMode
) external returns (uint256) {
    IERC20(asset).approve(address(pool), amount);

    return pool.repay(
        asset,
        amount,
        rateMode,
        msg.sender
    );
}
```

### Get User Account Data

```solidity
function getUserData(address user) external view returns (
    uint256 totalCollateralBase,
    uint256 totalDebtBase,
    uint256 availableBorrowsBase,
    uint256 currentLiquidationThreshold,
    uint256 ltv,
    uint256 healthFactor
) {
    return pool.getUserAccountData(user);
}
```

---

## Compound V3 Integration

```solidity
import {IComet} from "@compound-finance/comet/interfaces/IComet.sol";

contract CompoundIntegration {
    IComet public constant usdc = IComet(0xc3d688B66703497DAA19211EEdff47f25384cdc3);

    function supply(uint256 amount) external {
        IERC20(usdc.baseToken()).approve(address(usdc), amount);
        usdc.supply(usdc.baseToken(), amount);
    }

    function withdraw(uint256 amount) external {
        usdc.withdraw(usdc.baseToken(), amount);
    }

    function getSupplyBalance(address account) external view returns (uint256) {
        return usdc.balanceOf(account);
    }
}
```

---

## Curve Finance Integration

### Swap on Curve

```solidity
interface ICurvePool {
    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);
}

contract CurveIntegration {
    ICurvePool public constant pool = ICurvePool(0xDC24316b9AE028F1497c275EB9192a3Ea0f67022);  // stETH pool

    function swap(
        int128 fromIndex,
        int128 toIndex,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256) {
        // Approve if needed
        return pool.exchange(fromIndex, toIndex, amountIn, minAmountOut);
    }
}
```

---

## Price Oracles

### Chainlink Price Feeds

```solidity
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract PriceOracle {
    AggregatorV3Interface internal priceFeed;

    constructor() {
        // ETH/USD on Ethereum mainnet
        priceFeed = AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    }

    function getLatestPrice() public view returns (int) {
        (
            ,
            int price,
            ,
            uint timeStamp,

        ) = priceFeed.latestRoundData();

        require(timeStamp > block.timestamp - 3600, "Stale price");
        return price;  // 8 decimals for USD pairs
    }
}
```

### Uniswap V3 TWAP

```solidity
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

function getTWAP(
    address pool,
    uint32 secondsAgo
) external view returns (uint256 price) {
    uint32[] memory secondsAgos = new uint32[](2);
    secondsAgos[0] = secondsAgo;
    secondsAgos[1] = 0;

    (int56[] memory tickCumulatives, ) = IUniswapV3Pool(pool).observe(secondsAgos);

    int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
    int24 arithmeticMeanTick = int24(tickCumulativesDelta / int56(uint56(secondsAgo)));

    price = OracleLibrary.getQuoteAtTick(
        arithmeticMeanTick,
        uint128(1e18),
        token0,
        token1
    );
}
```

---

## Flash Loans

### Aave Flash Loan

```solidity
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {IFlashLoanSimpleReceiver} from "@aave/core-v3/contracts/flashloan/interfaces/IFlashLoanSimpleReceiver.sol";

contract FlashLoanExample is IFlashLoanSimpleReceiver {
    IPoolAddressesProvider public constant ADDRESSES_PROVIDER =
        IPoolAddressesProvider(0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e);
    IPool public constant POOL = IPool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2);

    function requestFlashLoan(address asset, uint256 amount) external {
        POOL.flashLoanSimple(
            address(this),
            asset,
            amount,
            "",  // params
            0    // referralCode
        );
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(POOL), "Unauthorized");

        // YOUR ARBITRAGE LOGIC HERE
        // You have `amount` of `asset` available
        // Must repay `amount + premium` by end of transaction

        uint256 amountOwed = amount + premium;
        IERC20(asset).approve(address(POOL), amountOwed);

        return true;
    }

    function ADDRESSES_PROVIDER() external view override returns (IPoolAddressesProvider) {
        return ADDRESSES_PROVIDER;
    }

    function POOL() external view override returns (IPool) {
        return POOL;
    }
}
```

---

## Security Considerations

**DeFi-Specific Risks**:
1. **Oracle Manipulation** - Use TWAPs or Chainlink
2. **Flash Loan Attacks** - Protect against price manipulation
3. **Reentrancy** - Especially in callbacks (flash loans)
4. **Slippage** - Always set `amountOutMinimum`
5. **Front-Running** - Use MEV protection or private mempools
6. **Smart Contract Risk** - Protocols can be exploited

**Best Practices**:
- Always use latest protocol versions
- Set deadline on time-sensitive txs
- Implement circuit breakers
- Monitor for unusual activity
- Have emergency pause functions

---

## Activation

Loads when: uniswap, aave, compound, curve, defi, swap, lending, liquidity, AMM

**Token Budget**: ~700 tokens

---

**Version**: 1.0.0
**Last Updated**: 2025-11-12

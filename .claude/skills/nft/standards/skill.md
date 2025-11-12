# NFT Standards Skill

```yaml
---
name: nft-standards
description: Expert knowledge of NFT token standards (ERC-721, ERC-1155, ERC-721A) including minting, metadata, royalties (ERC-2981), and marketplace integration
triggers:
  keywords: [nft, erc-721, erc-1155, erc721a, metadata, royalties, opensea]
dependencies: ["evm-expert"]
version: 1.0.0
priority: medium
token_budget: 600
---
```

## ERC-721 (Standard NFT)

### Basic Implementation

```solidity
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MyNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public constant MINT_PRICE = 0.08 ether;

    string private _baseTokenURI;

    constructor() ERC721("My NFT Collection", "MNFT") {
        _baseTokenURI = "ipfs://QmYourCIDHere/";
    }

    function mint() external payable {
        require(_tokenIdCounter.current() < MAX_SUPPLY, "Max supply reached");
        require(msg.value >= MINT_PRICE, "Insufficient payment");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(msg.sender, tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
```

---

## ERC-721A (Gas-Optimized)

**ERC-721A**: Optimizes gas for batch minting (OpenSea standard).

```solidity
import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721A, Ownable {
    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public constant MAX_PER_TX = 5;
    uint256 public constant MINT_PRICE = 0.08 ether;

    string private _baseTokenURI;

    constructor() ERC721A("My NFT", "MNFT") {
        _baseTokenURI = "ipfs://QmYourCID/";
    }

    function mint(uint256 quantity) external payable {
        require(_totalMinted() + quantity <= MAX_SUPPLY, "Max supply");
        require(quantity <= MAX_PER_TX, "Max per tx");
        require(msg.value >= MINT_PRICE * quantity, "Insufficient payment");

        _mint(msg.sender, quantity);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;  // Start from token ID 1 instead of 0
    }
}
```

**Gas Savings**: ~3x cheaper for batch minting vs standard ERC-721.

---

## ERC-1155 (Multi-Token Standard)

**Use Cases**: Gaming items, semi-fungible tokens, efficient collections.

```solidity
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameItems is ERC1155, Ownable {
    uint256 public constant SWORD = 1;
    uint256 public constant SHIELD = 2;
    uint256 public constant POTION = 3;

    constructor() ERC1155("ipfs://QmYourCID/{id}.json") {}

    function mint(
        address account,
        uint256 id,
        uint256 amount
    ) external onlyOwner {
        _mint(account, id, amount, "");
    }

    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) external onlyOwner {
        _mintBatch(to, ids, amounts, "");
    }

    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
    }
}
```

---

## Metadata Standards

### Token URI Structure

```json
{
  "name": "NFT #1234",
  "description": "A rare collectible from My Collection",
  "image": "ipfs://QmImageCID/1234.png",
  "external_url": "https://mycollection.com/nft/1234",
  "attributes": [
    {
      "trait_type": "Background",
      "value": "Blue"
    },
    {
      "trait_type": "Eyes",
      "value": "Laser"
    },
    {
      "trait_type": "Rarity",
      "value": "Legendary",
      "display_type": "string"
    },
    {
      "trait_type": "Power",
      "value": 95,
      "max_value": 100,
      "display_type": "number"
    }
  ],
  "properties": {
    "generation": 1,
    "created_date": 1699999999
  }
}
```

### Dynamic Metadata

```solidity
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract OnChainNFT is ERC721 {
    using Strings for uint256;

    struct TokenData {
        uint256 level;
        uint256 power;
        string color;
    }

    mapping(uint256 => TokenData) public tokenData;

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        TokenData memory data = tokenData[tokenId];

        string memory json = string(abi.encodePacked(
            '{',
            '"name": "NFT #', tokenId.toString(), '",',
            '"description": "Dynamic On-Chain NFT",',
            '"image": "data:image/svg+xml;base64,', _generateSVG(tokenId), '",',
            '"attributes": [',
            '{"trait_type": "Level", "value": ', data.level.toString(), '},',
            '{"trait_type": "Power", "value": ', data.power.toString(), '}',
            ']',
            '}'
        ));

        return string(abi.encodePacked(
            'data:application/json;base64,',
            Base64.encode(bytes(json))
        ));
    }

    function _generateSVG(uint256 tokenId) internal view returns (string memory) {
        // Generate SVG based on token data...
        return Base64.encode(bytes('<svg>...</svg>'));
    }
}
```

---

## ERC-2981 (Royalties Standard)

```solidity
import "@openzeppelin/contracts/token/common/ERC2981.sol";

contract MyNFTWithRoyalties is ERC721, ERC2981 {
    constructor() ERC721("My NFT", "MNFT") {
        // Set default royalty to 5% (500 basis points)
        _setDefaultRoyalty(msg.sender, 500);
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator)
        external
        onlyOwner
    {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 feeNumerator
    ) external onlyOwner {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    // Required override for multiple inheritance
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

---

## Whitelist & Presale

### Merkle Tree Whitelist

```solidity
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract WhitelistNFT is ERC721A {
    bytes32 public merkleRoot;
    mapping(address => bool) public hasMinted;

    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
    }

    function whitelistMint(bytes32[] calldata proof) external payable {
        require(!hasMinted[msg.sender], "Already minted");
        require(_verify(proof, msg.sender), "Not whitelisted");
        require(msg.value >= MINT_PRICE, "Insufficient payment");

        hasMinted[msg.sender] = true;
        _mint(msg.sender, 1);
    }

    function _verify(bytes32[] calldata proof, address addr)
        internal
        view
        returns (bool)
    {
        bytes32 leaf = keccak256(abi.encodePacked(addr));
        return MerkleProof.verify(proof, merkleRoot, leaf);
    }
}
```

**Generate Merkle Tree** (JavaScript):
```javascript
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

const whitelist = ['0xAddress1', '0xAddress2', '0xAddress3'];
const leaves = whitelist.map(addr => keccak256(addr));
const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

const root = tree.getRoot().toString('hex');
const proof = tree.getHexProof(keccak256('0xAddress1'));

console.log('Root:', root);
console.log('Proof:', proof);
```

---

## Opensea Integration

### Contract Metadata (Collection-Level)

```solidity
function contractURI() public pure returns (string memory) {
    return "ipfs://QmYourContractMetadataCID/contract.json";
}
```

**contract.json**:
```json
{
  "name": "My NFT Collection",
  "description": "A unique collection of 10,000 NFTs",
  "image": "ipfs://QmCollectionImageCID/banner.png",
  "external_link": "https://mycollection.com",
  "seller_fee_basis_points": 500,
  "fee_recipient": "0xYourAddress"
}
```

### Opensea Operator Filter (Royalty Enforcement)

```solidity
import "operator-filter-registry/src/DefaultOperatorFilterer.sol";

contract MyNFT is ERC721, DefaultOperatorFilterer {
    // Blocks marketplaces that don't respect royalties

    function setApprovalForAll(address operator, bool approved)
        public
        override
        onlyAllowedOperatorApproval(operator)
    {
        super.setApprovalForAll(operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId)
        public
        override
        onlyAllowedOperator(from)
    {
        super.transferFrom(from, to, tokenId);
    }
}
```

---

## Advanced Patterns

### Soulbound Tokens (Non-Transferable)

```solidity
contract SoulboundNFT is ERC721 {
    function _transfer(address, address, uint256) internal pure override {
        revert("Soulbound: Transfer not allowed");
    }

    function approve(address, uint256) public pure override {
        revert("Soulbound: Approval not allowed");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("Soulbound: Approval not allowed");
    }
}
```

### Reveal Mechanism

```solidity
contract RevealableNFT is ERC721A {
    bool public revealed = false;
    string private _unrevealedURI;
    string private _revealedBaseURI;

    function _baseURI() internal view override returns (string memory) {
        return revealed ? _revealedBaseURI : _unrevealedURI;
    }

    function reveal(string memory revealedURI) external onlyOwner {
        require(!revealed, "Already revealed");
        _revealedBaseURI = revealedURI;
        revealed = true;
    }
}
```

---

## Testing NFTs

```javascript
import { expect } from "chai";
import { ethers } from "hardhat";

describe("MyNFT", function () {
  it("Should mint NFT", async function () {
    const [owner, addr1] = await ethers.getSigners();

    const MyNFT = await ethers.getContractFactory("MyNFT");
    const nft = await MyNFT.deploy();

    await nft.connect(addr1).mint({ value: ethers.parseEther("0.08") });

    expect(await nft.ownerOf(0)).to.equal(addr1.address);
    expect(await nft.balanceOf(addr1.address)).to.equal(1);
  });

  it("Should respect max supply", async function () {
    const nft = await MyNFT.deploy();

    // Mint to max supply...

    await expect(
      nft.mint({ value: ethers.parseEther("0.08") })
    ).to.be.revertedWith("Max supply reached");
  });
});
```

---

## Activation

Loads when: nft, erc-721, erc-1155, erc721a, metadata, royalties, opensea

**Token Budget**: ~600 tokens

---

**Version**: 1.0.0
**Last Updated**: 2025-11-12

---
name: nft-mint
description: Mint NFTs on Ethereum and Solana including ERC721, ERC1155, metadata upload, and collection management
allowed-tools: ["Bash", "Read", "Write", "Grep"]
argument-hint: "NFT details or mint request"
model: sonnet
---

# NFT Mint Skill

## Activation Triggers

Activate when user:
- Wants to mint or create NFTs
- Mentions ERC721, ERC1155, or NFT standards
- Asks about NFT collections
- Wants to upload metadata to IPFS
- Uses keywords: "mint", "NFT", "collection", "metadata"

## Capabilities

- Mint ERC721 (single NFTs)
- Mint ERC1155 (multi-edition NFTs)
- Mint Solana NFTs (Metaplex)
- Upload metadata to IPFS/Arweave
- Create NFT collections
- Set royalties
- Lazy minting support
- Batch minting

## Minting Workflow

### 1. Prepare Metadata

**User**: "Mint an NFT with this image"

**Actions**:
```typescript
// Upload to IPFS
const metadata = {
  name: "Cool NFT #1",
  description: "A very cool NFT",
  image: "ipfs://Qm...", // Image CID
  attributes: [
    { trait_type: "Background", value: "Blue" },
    { trait_type: "Rarity", value: "Common" }
  ]
};

// Upload metadata JSON
const metadataUri = await uploadToIPFS(JSON.stringify(metadata));
```

### 2. Mint ERC721

```typescript
import { ethers } from 'ethers';

// Assuming deployed ERC721 contract
const nft = new ethers.Contract(nftAddress, ERC721_ABI, signer);

const tx = await nft.mint(
  recipient,
  tokenId,
  metadataUri
);

await tx.wait();
```

**Output**:
```
╔═══════════════════════════════════════════════════╗
║  NFT Minted Successfully                          ║
╚═══════════════════════════════════════════════════╝

Collection: Cool NFTs
Token ID: #1
Owner: 0x742d...f0bEb

Metadata:
  Name: Cool NFT #1
  Image: ipfs://Qm...
  Attributes: 2

Transaction: 0xabc...def
Gas Used: 180,000
Cost: 0.0054 ETH

View on OpenSea:
https://testnets.opensea.io/assets/sepolia/0x.../1
```

### 3. Create Collection

**User**: "Create an NFT collection called 'Crypto Punks 2.0'"

**Actions**:
```typescript
// Deploy new ERC721 contract
const NFTCollection = await ethers.getContractFactory('ERC721Collection');

const collection = await NFTCollection.deploy(
  "Crypto Punks 2.0",      // name
  "PUNK2",                  // symbol
  "ipfs://Qm.../",          // baseURI
  10000,                    // max supply
  ethers.parseEther("0.1"), // mint price
  250                       // royalty (2.5%)
);

await collection.waitForDeployment();
```

**Output**:
```
✓ NFT Collection Created

Name: Crypto Punks 2.0
Symbol: PUNK2
Contract: 0x1234...5678
Max Supply: 10,000
Mint Price: 0.1 ETH
Royalty: 2.5%

Metadata Base URI: ipfs://Qm.../
Contract verified: ✓

Ready to mint!
```

## NFT Standards

### ERC721 (Single NFT)

```solidity
contract MyNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    function mint(address to, string memory uri)
        public
        onlyOwner
        returns (uint256)
    {
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }
}
```

### ERC1155 (Multi-Edition)

```solidity
contract MyMultiNFT is ERC1155, Ownable {
    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public onlyOwner {
        _mint(to, id, amount, data);
    }
}
```

### Solana/Metaplex

```typescript
import { Metaplex } from '@metaplex-foundation/js';

const metaplex = Metaplex.make(connection);

const { nft } = await metaplex.nfts().create({
  name: "My NFT",
  symbol: "MNFT",
  uri: metadataUri,
  sellerFeeBasisPoints: 250, // 2.5% royalty
});
```

## Metadata Format

### Standard NFT Metadata (OpenSea compatible)

```json
{
  "name": "Cool NFT #1",
  "description": "A very cool NFT from the collection",
  "image": "ipfs://QmX.../image.png",
  "external_url": "https://mycollection.com/nft/1",
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
      "trait_type": "Rarity Score",
      "value": 85,
      "display_type": "number"
    }
  ],
  "properties": {
    "category": "image",
    "creators": [
      {
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "share": 100
      }
    ]
  }
}
```

## IPFS Upload

```typescript
import { create } from 'ipfs-http-client';

const ipfs = create({ url: 'https://ipfs.infura.io:5001/api/v0' });

// Upload image
const imageResult = await ipfs.add(imageFile);
const imageCID = imageResult.cid.toString();

// Upload metadata
const metadataResult = await ipfs.add(JSON.stringify(metadata));
const metadataCID = metadataResult.cid.toString();

return `ipfs://${metadataCID}`;
```

## Examples

### Example 1: Mint Single NFT

**User**: "Mint an NFT with image.png"

1. Upload image to IPFS
2. Create metadata JSON
3. Upload metadata to IPFS
4. Call mint function
5. Wait for confirmation
6. Display OpenSea link

### Example 2: Batch Mint

**User**: "Mint 100 NFTs from this folder"

```typescript
const files = await readdir('./nft-assets/');

for (const file of files) {
  // Upload each
  const imageCID = await uploadToIPFS(file);
  const metadata = generateMetadata(file, imageCID);
  const metadataCID = await uploadToIPFS(metadata);

  // Mint
  await nft.mint(recipient, nextTokenId++, `ipfs://${metadataCID}`);

  console.log(`Minted #${nextTokenId - 1}`);
}
```

### Example 3: Set Royalties

**User**: "Set 5% royalties for my collection"

```typescript
// EIP-2981 Royalty Standard
contract MyNFT is ERC721, ERC2981 {
    constructor() ERC721("MyNFT", "MNFT") {
        _setDefaultRoyalty(owner(), 500); // 5% = 500/10000
    }
}
```

## Related Skills

- Use `contract-deploy` to deploy NFT contracts
- Use `blockchain-query` to check NFT ownership
- Use `security-audit` to verify NFT contract safety

import FrakButton4 from "../components/button4";
import MintCard from "../components/mintCard";
import ListCard from "../components/listCard";
import {
  VStack,
  Box,
  Stack,
  Grid,
  Text,
  Link,
  Checkbox,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Image as ImageComponent } from "@chakra-ui/image";
import { useWeb3Context } from "../contexts/Web3Context";
import { useUserContext } from "../contexts/userContext";
import { utils } from "ethers";
import {
  createNFT,
  approveMarket,
  importFraktal,
  getIndexUsed,
  listItem,
  getApproved,
  importERC721,
  importERC1155,
} from "../utils/contractCalls";
import { pinByHash } from "../utils/pinataPinner";
import { useRouter } from "next/router";
import NFTItem from "../components/nft-item";
import { useMintingContext } from "@/contexts/NFTIsMintingContext";
import toast from "react-hot-toast";

const { create } = require("ipfs-http-client");

export default function MintPage() {
  const { fraktals, nfts } = useUserContext();
  const { isMinting, setIsMinting } = useMintingContext();
  const router = useRouter();
  const { account, provider, marketAddress, factoryAddress } = useWeb3Context();
  const [ipfsNode, setIpfsNode] = useState();
  const [status, setStatus] = useState("mint");
  const [imageData, setImageData] = useState(null);
  const [imageSize, setImageSize] = useState([]);
  const [name, setName] = useState();
  const [description, setDescription] = useState();
  const [file, setFile] = useState();
  const [listItemCheck, setListItemCheck] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [minted, setMinted] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [fraktionalized, setFraktionalized] = useState(false);
  const [listed, setListed] = useState(false);
  const [tokenMintedAddress, setTokenMintedAddress] = useState();
  const [tokenToImport, setTokenToImport] = useState();
  const [nftApproved, setNftApproved] = useState(false);

  // detect states (where is NFT and if its ready to list so send it here for listing!)

  // FUNCTIONS FOR MINTING
  useEffect(() => {
    const ipfsClient = create({
      host: "ipfs.infura.io",
      port: "5001",
      protocol: "https",
    });
    setIpfsNode(ipfsClient);
  }, []);

  async function uploadAndPin(data) {
    let dataUpload;
    try {
      dataUpload = await ipfsNode.add(data);
    } catch (e) {
      console.error("Error: ", e);
      return "Error uploading the file";
    }
    await pinByHash(dataUpload.cid.toString()); // Pinata
    return dataUpload;
  }

  async function prepareNftData() {
    let results = await uploadAndPin(file);
    let metadata = {
      name: name,
      description: description,
      image: results.path,
    };
    await minter(metadata);
  }

  async function minter(metadata) {
    let metadataCid = await uploadAndPin(JSON.stringify(metadata));
    if (metadataCid) {
      setIsMinting(true);
      const response = await createNFT(
        metadataCid.cid.toString(),
        provider,
        factoryAddress
      );
      if (response?.error) {
        toast.error("Transaction failed.");
        setIsMinting(false);
      }
      if (!response?.error) {
        toast.success("Mint completed.");
        setIsMinting(false);
        setTokenMintedAddress(response);

        let mintingArray = [];
        if (window?.localStorage.getItem("mintingNFTS")) {
          let mintingNFTSString = window?.localStorage.getItem("mintingNFTS");
          let mintingNFTS = JSON.parse(mintingNFTSString);
          mintingArray = [...mintingNFTS, response];
        } else {
          mintingArray = [response];
        }
        let mintingArrayString = JSON.stringify(mintingArray);
        window?.localStorage.setItem("mintingNFTs", mintingArrayString);
        setMinted(true);
      }
    }
  }

  async function addFile() {
    const selectedFile = document.getElementById("imageInput").files[0];
    setFile(selectedFile);
    let reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onloadend = function () {
      setImageData(reader.result);
      var image = new Image();
      image.src = reader.result;
      image.onload = function () {
        setImageSize(this.width, this.height);
      };
    };
  }

  const proportionalImage = width => {
    return (imageSize[1] / imageSize[0]) * width;
  };

  // FUNCTIONS FOR LISTING
  const fraktalReady =
    minted &&
    totalAmount > 0 &&
    totalAmount <= 10000 &&
    totalPrice > 0 &&
    isApproved;

  async function approveToken() {
    await approveMarket(marketAddress, provider, tokenMintedAddress).then(
      () => {
        setIsApproved(true);
        importFraktalToMarket();
      }
    );
  }

  async function importFraktalToMarket() {
    let index = 0;
    let isUsed = true;
    while (isUsed == true) {
      index += 1;
      isUsed = await getIndexUsed(index, provider, tokenMintedAddress);
    }
    if (isUsed == false) {
      await importFraktal(
        tokenMintedAddress,
        index,
        provider,
        marketAddress
      ).then(() => {
        setFraktionalized(true);
        listNewItem();
      });
    }
  }

  async function approveNFT() {
    if (tokenToImport && tokenToImport.id) {
      let res = await approveMarket(factoryAddress, provider, tokenToImport.id);
      if (res) {
        setNftApproved(true);
      }
    }
  }

  async function importNFT() {
    let address;
    if (tokenToImport.token_schema == "ERC721") {
      address = await importERC721(
        parseInt(tokenToImport.tokenId),
        tokenToImport.id,
        provider,
        factoryAddress
      );
    } else {
      address = await importERC1155(
        parseInt(tokenToImport.tokenId),
        tokenToImport.id,
        provider,
        factoryAddress
      );
    }
    if (address) {
      setTokenMintedAddress(address);
      setMinted(true);
    }
  }

  async function listNewItem() {
    listItem(
      tokenMintedAddress,
      totalAmount,
      utils.parseUnits(totalPrice).div(totalAmount),
      provider,
      marketAddress
    ).then(() => {
      router.push("/");
    });
  }

  useEffect(() => {
    if (listItemCheck && tokenMintedAddress) {
      approveToken();
    }
  }, [tokenMintedAddress]);

  let msg = () => {
    if (!minted) {
      return "Mint your new token to start the process of Fraktionalization and Listing.";
    } else if (minted && !isApproved) {
      return "NFT succesfully minted! Approve the transfer of your Fraktal NFT and future Fraktions transfers.";
    } else if (minted && isApproved && !fraktionalized) {
      return "Transfer rights granted! Now transfer your Fraktal NFT to the Marketplace. The Fraktions will remain in your wallet.";
    } else {
      return "Fraktal NFT received! List your Fraktions on the Marketplace. If someone buys your Fraktions the Marketplace contract will transfer them";
    }
  };

  return (
    <div>
      <Box
        sx={{
          display: `grid`,
          gridTemplateColumns: `400px 621px`,
          columnGap: `16px`,
        }}
      >
        <Box sx={{ position: `relative` }}>
          <VStack marginRight="53px" sx={{ position: `sticky`, top: `20px` }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: "48px",
                lineHeight: "64px",
                color: "black",
              }}
            >
              Mint NFT
            </div>
            <div
              style={{
                marginTop: "24px",
                marginBottom: "16px",
                fontWeight: 600,
                fontSize: "12px",
                lineHeight: "14px",
                letterSpacing: "1px",
                color: "#656464",
              }}
            >
              PREVIEW
            </div>
            <ImageComponent
              src={imageData ? imageData : null}
              w="400px"
              h={imageData ? proportionalImage(400) : "400px"}
              style={{ borderRadius: "4px 4px 0px 0px", objectFit: `cover` }}
            />
            <div
              style={{
                fontWeight: "bold",
                fontSize: "16px",
                lineHeight: "19px",
                color: "#000000",
              }}
            >
              {name ? name : "name"}
            </div>
          </VStack>
        </Box>
        <Stack spacing="0" mb="12.8rem">
          <div style={{ marginBottom: "24px", display: `flex`, gap: `16px` }}>
            <Link
              className="semi-16"
              borderRadius="25"
              padding="5"
              sx={{
                backgroundColor: `black`,
                color: `white`,
                border: `2px solid transparent`,
              }}
              _hover={{ color: `white` }}
              onClick={() => null}
            >
              Mint NFT
            </Link>
            <Link
              className="semi-16"
              borderRadius="25"
              padding="5"
              _hover={{ bg: "black", textColor: "white" }}
              onClick={() => router.push("/import-nft")}
            >
              Import NFT
            </Link>
          </div>
          <div>
            <MintCard
              setName={setName}
              setDescription={setDescription}
              addFile={addFile}
              file={file}
            />
          </div>
          <div style={{ marginTop: "16px" }}>
            <Box
              sx={{
                display: `flex`,
                gap: `12px`,
                alignItems: `center`,
                marginBottom: `8px`,
              }}
            >
              {listItemCheck && (
                <Box
                  sx={{
                    width: `16px`,
                    height: `16px`,
                    borderRadius: `4px`,
                    display: `block`,
                    backgroundColor: `#00C49D`,
                  }}
                  _hover={{
                    cursor: `pointer`,
                  }}
                  onClick={() => setListItemCheck(!listItemCheck)}
                ></Box>
              )}
              {!listItemCheck && (
                <Box
                  sx={{
                    width: `16px`,
                    height: `16px`,
                    borderRadius: `4px`,
                    border: `2px solid rgba(0,0,0,0.3)`,
                    display: `block`,
                  }}
                  _hover={{
                    cursor: `pointer`,
                  }}
                  onClick={() => setListItemCheck(!listItemCheck)}
                ></Box>
              )}
              <Text
                sx={{
                  fontSize: `16px`,
                  fontFamily: `Inter, sans-serif`,
                  fontWeight: `700`,
                }}
                _hover={{
                  cursor: `pointer`,
                }}
                onClick={() => setListItemCheck(!listItemCheck)}
              >
                List your Fraktion NFT for sale
              </Text>
            </Box>
            <div>
              {listItemCheck && (
                <ListCard
                  totalPrice={totalPrice}
                  setTotalPrice={setTotalPrice}
                  setTotalAmount={setTotalAmount}
                />
              )}
            </div>
          </div>
          <div
            style={{
              marginTop: "24px",
              justifyItems: "space-between",
              display: `flex`,
              gap: `16px`,
            }}
          >
            <FrakButton4
              status={!minted ? "open" : "done"}
              disabled={!name || !imageData}
              onClick={() => prepareNftData()}
            >
              1. Mint
            </FrakButton4>
            {listItemCheck && (
              <>
                <FrakButton4
                  status={!isApproved ? "open" : "done"}
                  disabled={!tokenMintedAddress}
                  onClick={() => approveToken()}
                >
                  2. Approve
                </FrakButton4>
                <FrakButton4
                  status={!fraktionalized ? "open" : "done"}
                  disabled={!isApproved || !tokenMintedAddress}
                  onClick={() => importFraktalToMarket()}
                >
                  3. Transfer
                </FrakButton4>
                <FrakButton4
                  status={!listed ? "open" : "done"}
                  disabled={!fraktalReady}
                  onClick={() => listNewItem()}
                >
                  4. List
                </FrakButton4>
              </>
            )}
          </div>
          <div
            style={{
              marginTop: "16px",
              color: "#405466",
              fontSize: "16px",
              fontWeight: 600,
              lineHeight: "19px",
            }}
          >
            {msg()}
          </div>
        </Stack>
      </Box>
    </div>
  );
}

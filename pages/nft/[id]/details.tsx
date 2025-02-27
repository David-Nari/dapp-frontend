import Link from "next/link";
import { Text } from "@chakra-ui/react";
import { utils } from "ethers";
import FrakButton from "../../../components/button";
import styles from "./auction.module.css";
import { HStack, VStack, Box, Stack, Spinner } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import FraktionsList from "../../../components/fraktionsList";
import RevenuesList from "../../../components/revenuesList";
import UserOwnership from "../../../components/userOwnership";
import BuyOutCard from "../../../components/buyOutCard";
import FraktionOwners from "../../../components/fraktionOwners";
import { Image } from "@chakra-ui/image";
import { shortenHash, timezone } from "../../../utils/helpers";
import { getSubgraphData } from "../../../utils/graphQueries";
import { createObject2 } from "../../../utils/nftHelpers";
import { useWeb3Context } from "../../../contexts/Web3Context";
import {
  getBalanceFraktions,
  getMinimumOffer,
  unlistItem,
  getApproved,
  getFraktionsIndex,
  claimFraktalSold,
  isFraktalOwner,
} from "../../../utils/contractCalls";
import { useRouter } from "next/router";
// import { CONNECT_BUTTON_CLASSNAME } from "web3modal";
// import Modal from '../../../components/modal';


const etherscanAddress = "https://rinkeby.etherscan.io/address/";

export default function DetailsView() {
  const router = useRouter();
  const { account, provider, marketAddress, factoryAddress } = useWeb3Context();
  const [offers, setOffers] = useState();
  const [minOffer, setMinOffer] = useState(0);
  const [nftObject, setNftObject] = useState({});
  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [fraktionsListed, setFraktionsListed] = useState([]);
  const [userHasListed, setUserHasListed] = useState(false);
  const [collateralNft, setCollateralNft] = useState();
  const [fraktionsApproved, setFraktionsApproved] = useState(false);
  const [factoryApproved, setFactoryApproved] = useState(false);
  const [userFraktions, setUserFraktions] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [revenues, setRevenues] = useState();
  const [isPageReady, setIsPageReady] = useState<boolean>(false);
  // const [txInProgress, setTxInProgress] = useState(false);
  const [fraktionsIndex, setFraktionsIndex] = useState();
  const [args, setArgs] = useState([]);
  const [investors, setInvestors] = useState(0);
  // use callbacks

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (router.isReady) {
      let pathname = router.asPath;
      let args = pathname.split("/");
      do {
        pathname = router.asPath;
        setArgs(pathname.split("/"));
        setIsPageReady(false);
      } while (args[2] === "[id]" || typeof args[2] === "undefined");
      // console.log('setting ready to true with:',args[2])
      setIsPageReady(true);
    }
  }, [router]);

  async function getFraktal() {
    const tokenAddress = args[2];
    const tokenAddressSplitted = tokenAddress.toLocaleLowerCase();
    setTokenAddress(tokenAddressSplitted);
    let fraktionsFetch = await getSubgraphData(
      "fraktions",
      tokenAddressSplitted
    );
    // console.log(fraktionsFetch);
    if (fraktionsFetch.listItems) {
      setFraktionsListed(fraktionsFetch.listItems);
    }
    let fraktalFetch = await getSubgraphData("fraktal", tokenAddressSplitted);
    if (
      fraktalFetch &&
      fraktalFetch.fraktalNfts &&
      fraktalFetch.fraktalNfts[0]
    ) {
      let nftObjects = await createObject2(fraktalFetch.fraktalNfts[0]);
      if (nftObjects) {
        let investorsWBalance = nftObjects.balances.filter(x => {
          return parseInt(x.amount) > 0;
        });
        // console.log('investors',investorsWBalance)
        setInvestors(investorsWBalance.length);
        setNftObject(nftObjects);
      }
      if (fraktalFetch.fraktalNfts[0].offers) {
        setOffers(fraktalFetch.fraktalNfts[0].offers);
      }
      if (fraktalFetch.fraktalNfts[0].collateral) {
        setCollateralNft(fraktalFetch.fraktalNfts[0].collateral);
      }
      let revenuesValid = fraktalFetch.fraktalNfts[0].revenues.filter(x => {
        return x.value > 0;
      });
      if (revenuesValid) {
        setRevenues(revenuesValid);
      }
    }
  }

  async function getFraktions() {
    if (fraktionsListed && account && tokenAddress) {
      let fraktionsFetch = await getSubgraphData("fraktions", tokenAddress);
      let userFraktionsListed = fraktionsFetch?.listItems?.find(
        x => x.seller.id == account.toLocaleLowerCase()
      );
      if (userFraktionsListed && userFraktionsListed?.amount > 0) {
        setUserHasListed(true);
      }
    } else setUserHasListed(false);
  }

  async function getContractData() {
    if (tokenAddress && account && provider) {
      try {
        let userBalance = await getBalanceFraktions(
          account,
          provider,
          tokenAddress
        );
        let index = await getFraktionsIndex(provider, tokenAddress);
        let marketApproved = await getApproved(
          account,
          marketAddress,
          provider,
          tokenAddress
        );
        let factoryApproved = await getApproved(
          account,
          factoryAddress,
          provider,
          tokenAddress
        );
        let isOwner = await isFraktalOwner(account, provider, tokenAddress);
        setFraktionsIndex(index);
        setFraktionsApproved(marketApproved);
        setFactoryApproved(factoryApproved);
        setUserFraktions(userBalance);
        setIsOwner(isOwner);
      } catch (e) {
        console.error("Error:", e);
      }
    }
  }

  async function getOffers() {
    if (tokenAddress && marketAddress) {
      let minPriceParsed;
      try {
        let minPrice = await getMinimumOffer(
          tokenAddress,
          provider,
          marketAddress
        );
        minPriceParsed = utils.formatEther(minPrice);
      } catch {
        minPriceParsed = 0;
      }
      setMinOffer(minPriceParsed);
    }
  }

  const [fraktionsGot, setFraktionsGot] = useState(false);
  const [fraktalsGot, setFraktalsGot] = useState(false);
  const [offersGot, setOffersGot] = useState(false);
  const [contractDataGot, setContractDataGot] = useState(false);


  useEffect(() => {
    async function getAllData() {
      if (isPageReady) {
        if (!fraktionsGot) {
          await getFraktions();
          setFraktionsGot(true);
        }
        if (!fraktalsGot) {
          await getFraktal();
          setFraktalsGot(true);
        }
        if (!offersGot) {
          await getOffers();
          setOffersGot(true);
        }
        if (!contractDataGot) {
          await getContractData();
          setContractDataGot(true);
        }
        setIsLoading(false);
      }
    }
    getAllData();
  }, [
    isPageReady,
    account,
    provider,
    tokenAddress,
    fraktionsListed,
    nftObject,
    marketAddress,
  ]);

  async function callUnlistItem() {
    let tx = await unlistItem(tokenAddress, provider, marketAddress);
    if (typeof tx !== "undefined") {
      router.push("/my-nfts");
    }
  }

  async function claimFraktal() {
    // this one goes to offersCard
    try {
      await claimFraktalSold(tokenAddress, provider, marketAddress);
    } catch (e) {
      console.error("There has been an error: ", e);
    }
  }


  return (
    <>
      {isLoading && (
        <>
          <Box sx={{ display: `grid`, width: `100%`, placeItems: `center` }}>
            <Spinner size="xl" />
          </Box>
        </>
      )}
      {!isLoading && (
        <Box
          sx={{
            display: `grid`,
            gridTemplateColumns: `400px 621px`,
            columnGap: `16px`,
          }}
        >
          <Box sx={{ position: `relative` }}>
            <VStack marginRight="53px" sx={{ position: `sticky`, top: `20px` }}>
              <Link href="/">
                <div className={styles.goBack}>← back to all NFTS</div>
              </Link>
              <Image
                src={nftObject ? nftObject.imageURL : null}
                w="400px"
                h="400px"
                style={{ borderRadius: "4px 4px 0px 0px", objectFit: `cover` }}
              />
              <HStack justifyContent="space-between" marginTop="16px">
                <VStack>
                  <div
                    style={{
                      fontFamily: "Inter",
                      fontWeight: 600,
                      fontSize: "12px",
                      lineHeight: "14px",
                      letterSpacing: "1px",
                      color: "#A7A7A7",
                    }}
                  >
                    ARTIST
                  </div>
                  <div
                    style={{
                      fontFamily: "Inter",
                      fontWeight: 500,
                      fontSize: "16px",
                      lineHeight: "19px",
                    }}
                  >
                    <Text
                      sx={{ color: `hsla(224, 86%, 51%, 1)` }}
                      _hover={{ cursor: `pointer` }}
                      onClick={() => router.push(`/artist/${nftObject.creator}`)}
                    >
                      {nftObject ?
                        shortenHash(nftObject.creator)
                        :
                        "loading"
                      }
                    </Text>
                  </div>
                </VStack>
                <VStack>
                  <div
                    style={{
                      fontFamily: "Inter",
                      fontWeight: 600,
                      fontSize: "12px",
                      lineHeight: "14px",
                      letterSpacing: "1px",
                      color: "#A7A7A7",
                    }}
                  >
                    DATE OF CREATION
                  </div>
                  <div
                    style={{
                      fontFamily: "Inter",
                      fontWeight: 500,
                      fontSize: "16px",
                      lineHeight: "19px",
                    }}
                  >
                    {nftObject ? timezone(nftObject.createdAt) : "loading"}
                  </div>
                </VStack>
              </HStack>
              <HStack>
              <VStack>
              <div
                    style={{
                      fontFamily: "Inter",
                      fontWeight: 600,
                      fontSize: "12px",
                      lineHeight: "14px",
                      letterSpacing: "1px",
                      color: "#A7A7A7",
                    }}
                  >
                    NFT Contract Address
                  </div>
                  <div
                    style={{
                      fontFamily: "Inter",
                      fontWeight: 500,
                      fontSize: "16px",
                      lineHeight: "19px",
                    }}
                  >
                    <a href={etherscanAddress+nftObject.id+"/"}>{nftObject ? shortenHash(nftObject.id) : "loading"}</a>
                  </div>
              </VStack>
              </HStack>
              {/* for the defrak bug, i leave this function to claim the fraktal
          <button onClick={()=>claimFraktal()}>Claim</button>
          */}
              <UserOwnership
                fraktions={userFraktions}
                isFraktalOwner={isOwner}
                collateral={collateralNft}
                isApproved={fraktionsApproved}
                marketAddress={marketAddress}
                tokenAddress={tokenAddress}
                marketId={nftObject ? nftObject.marketId : null}
                factoryAddress={factoryAddress}
                provider={provider}
                factoryApproved={factoryApproved}
              />
              <div style={{ marginTop: "21px" }}>
                {userHasListed && (
                  <FrakButton onClick={() => callUnlistItem()}>
                    Unlist Fraktions
                  </FrakButton>
                )}
                {!userHasListed && (
                  <FrakButton
                    disabled={fraktionsIndex == 0 || userFraktions < 1}
                    onClick={() =>
                      router.push(`/nft/${nftObject.marketId}/list-item`)
                    }
                  >
                    List Fraktions
                  </FrakButton>
                )}
              </div>
            </VStack>
          </Box>
          <Stack spacing="0" mb="12.8rem">
            <div
              style={{
                fontSize: "48px",
                fontFamily: "Inter",
                fontWeight: 800,
                lineHeight: "64px",
              }}
            >
              {nftObject ? nftObject.name : "Loading"}
            </div>
            <div
              style={{
                fontSize: "16px",
                fontFamily: "Inter",
                fontWeight: 400,
                lineHeight: "22px",
                marginBottom: "40px",
              }}
            >
              {nftObject && nftObject.description
                ? nftObject.description
                : null}
            </div>
            {nftObject && nftObject.status == "open" ? (
              <FraktionsList
                fraktionsListed={fraktionsListed}
                tokenAddress={tokenAddress}
                marketAddress={marketAddress}
                provider={provider}
              />
            ) : null}
            <div style={{ marginTop: "40px" }}>
              <BuyOutCard
                account={account}
                minPrice={minOffer}
                fraktionsBalance={userFraktions}
                fraktionsApproved={fraktionsApproved}
                investors={investors}
                offers={offers}
                tokenAddress={tokenAddress}
                marketAddress={marketAddress}
                provider={provider}
                itemStatus={
                  nftObject && nftObject.status ? nftObject.status : null
                }
              />
            </div>
            <div style={{ marginTop: "40px" }}>
              <RevenuesList
                account={account}
                revenuesCreated={revenues}
                tokenAddress={tokenAddress}
                marketAddress={marketAddress}
              />
            </div>
            <div style={{ marginTop: "40px" }}>
              <FraktionOwners data={nftObject.balances} nftObject={nftObject} />
            </div>
          </Stack>
          {/*
      <Modal
        open={txInProgress}
        onClose={()=>setTxInProgress(false)}
      >
        Tx's in course!
      </Modal>
    */}
        </Box>
      )}
    </>
  );
}

import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers, Contract, utils } from "ethers"
import Head from "next/head"
import Link from "next/link"
import React from "react"
import styles from "../styles/Home.module.css"

import { TextField } from '@material-ui/core';
import Greeter from 'artifacts/contracts/Greeters.sol/Greeters.json'

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const [greeting, setGreeting] = React.useState("Hello world")
    const [events, updateEvents] = React.useState("No greetings yet :(")

    const listener = async () => {
        const contract = new Contract('0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0', Greeter.abi)
        const provider = new providers.JsonRpcProvider('http://localhost:8545')

        const contractOwner = contract.connect(provider.getSigner())

        contractOwner.on('NewGreeting', (msg) => {
            updateEvents(utils.parseBytes32String(msg))
        })
    }

    React.useEffect(() => {
        listener()
    }, [])

    async function greet(greeting: string) {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        console.log("Sending message:", greeting)

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }

        listener();
    }

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <TextField
                    className={styles.textField}
                    id="message"
                    name="message"
                    label="Message"
                    variant="filled"
                    value={greeting}
                    onChange={(e) => {
                        setGreeting(e.target.value)
                    }}
                />

                <div onClick={() => greet(greeting)} className={styles.button}>
                    Greet
                </div>

                <h2>Test out our form <Link href="/form">here</Link></h2>

                <h1 className={styles.description}>Listened Greeting: {events}</h1>

            </main>
        </div>
    )
}

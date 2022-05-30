import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers } from "ethers"
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"

import { useFormik } from 'formik';
import * as yup from 'yup';
import { Button, TextField } from '@material-ui/core';

const validationSchema = yup.object({
    name: yup
      .string('Enter your name')
      .min(3, 'Name should be at least 3 characters long')
      .required('Name is required'),
    age: yup
      .number('Enter your age')
      .positive().integer()
      .required('Age is required'),
    address: yup
      .string('Enter your address')
      .min(5, 'Address should be at least 5 characters long')
      .required('Address is required'),
  });

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")

    async function greet() {
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

        const greeting = "Hello world"

        console.log("hello")

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
    }

    const formik = useFormik({
        initialValues: {
          name: '',
          age: '',
          address: '',
        },
        validationSchema: validationSchema,
        onSubmit: values => {
          const inputs = JSON.stringify(values, null, 2);
          console.log(inputs);
        },
      });

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>How are you doing?</h1>

                <p className={styles.description}>Send a message, make friends!</p>

                <div className={styles.logs}>{logs}</div>

                {/* <div onClick={() => greet()} className={styles.button}>
                    New
                </div> */}
                
                <form onSubmit={formik.handleSubmit}>
                    <TextField
                        className={styles.textField}
                        fullWidth
                        id="name"
                        name="name"
                        label="Name"
                        variant="filled"
                        value={formik.values.name}
                        onChange={formik.handleChange}
                        error={formik.touched.name && Boolean(formik.errors.name)}
                        helperText={formik.touched.name && formik.errors.name}
                    />

                    <div className={styles.seperator}/>

                    <TextField
                        className={styles.textField}
                        fullWidth
                        id="age"
                        name="age"
                        label="Age"
                        variant="filled"
                        value={formik.values.age}
                        onChange={formik.handleChange}
                        error={formik.touched.age && Boolean(formik.errors.age)}
                        helperText={formik.touched.age && formik.errors.age}
                    />

                    <div className={styles.seperator}/>

                    <TextField
                        className={styles.textField}
                        fullWidth
                        multiline
                        minRows={4}
                        id="address"
                        name="address"
                        label="Address"
                        variant="filled"
                        value={formik.values.address}
                        onChange={formik.handleChange}
                        error={formik.touched.address && Boolean(formik.errors.address)}
                        helperText={formik.touched.address && formik.errors.address}
                    />

                    <div className={styles.seperator}/>

                    <Button 
                        color="primary" 
                        variant="contained" 
                        fullWidth type="submit"
                    >
                        Submit
                    </Button>
                </form>
      
            </main>

            
        </div>
    )
}

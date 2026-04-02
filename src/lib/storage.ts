import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

type StorageConfig = {
  endpoint: string
  accessKey: string
  secretKey: string
  bucket: string
  region: string
}

type S3ResponseBody = {
  transformToByteArray?: () => Promise<Uint8Array>
  arrayBuffer?: () => Promise<ArrayBuffer>
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array | string>
}

let storageClient: S3Client | null = null

function getStorageConfig(): StorageConfig {
  const endpoint = process.env.S3_ENDPOINT
  const accessKey = process.env.S3_ACCESS_KEY
  const secretKey = process.env.S3_SECRET_KEY
  const bucket = process.env.S3_BUCKET
  const region = process.env.S3_REGION

  if (!endpoint || !accessKey || !secretKey || !bucket || !region) {
    throw new Error("S3 storage configuration is incomplete")
  }

  return {
    endpoint,
    accessKey,
    secretKey,
    bucket,
    region,
  }
}

function getStorageClient(): S3Client {
  if (storageClient) {
    return storageClient
  }

  const config = getStorageConfig()

  storageClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  })

  return storageClient
}

function isS3ResponseBody(value: unknown): value is S3ResponseBody {
  return typeof value === "object" && value !== null
}

async function readS3Body(body: unknown): Promise<Buffer> {
  if (!isS3ResponseBody(body)) {
    throw new Error("S3 response body is missing")
  }

  if (typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray())
  }

  if (typeof body.arrayBuffer === "function") {
    return Buffer.from(await body.arrayBuffer())
  }

  if (typeof body[Symbol.asyncIterator] === "function") {
    const chunks: Uint8Array[] = []
    const iteratorFactory =
      body[Symbol.asyncIterator] as NonNullable<S3ResponseBody[typeof Symbol.asyncIterator]>
    const asyncIterable: AsyncIterable<Uint8Array | string> = {
      [Symbol.asyncIterator]: iteratorFactory.bind(body),
    }

    for await (const chunk of asyncIterable) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    }

    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
  }

  throw new Error("Unsupported S3 response body type")
}

export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const client = getStorageClient()
  const { bucket } = getStorageConfig()

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  )
}

export async function getFileUrl(key: string): Promise<string> {
  const client = getStorageClient()
  const { bucket } = getStorageConfig()

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn: 60 * 5 }
  )
}

export async function deleteFile(key: string): Promise<void> {
  const client = getStorageClient()
  const { bucket } = getStorageConfig()

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  )
}

export async function getFileBuffer(key: string): Promise<Buffer> {
  const client = getStorageClient()
  const { bucket } = getStorageConfig()
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  )

  return readS3Body(response.Body)
}

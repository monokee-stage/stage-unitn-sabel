import Ajv from "ajv";
import { verifiableCredentialsSchema } from "./presentationCallback";

const ajv = new Ajv({allErrors: true})

// Can compile immediately
const validateVerifiableCredentials = ajv.compile(verifiableCredentialsSchema)

export * from "./presentationCallback"
export * from "./issueCallback"
export * from "./claims"
export {ajv, validateVerifiableCredentials}

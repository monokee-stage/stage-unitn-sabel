import { JSONSchemaType } from "ajv";
import { Claims, claimsSchema } from "./claims"

interface verifiableCredentials {
    issuer: string,
    type: Array<string>,
    claims: Claims, // Type depends on the VC requested from the user
    credentialState: {
        revocationStatus: string // "valid", "issuerRevoked"
    },
}

const verifiableCredentialsSchema: JSONSchemaType<verifiableCredentials> = {
    "$id": "schemas://verifiableCredentials",
    type: "object",
    properties: {
        issuer: {type: "string"},
        type: {type: "array", items: {type: "string"}},
        claims: claimsSchema,
        credentialState: {type: "object", properties: { revocationStatus: {type: "string"}}, 
            required: [], additionalProperties: true}
    },
    required: ["issuer", "type"],
    additionalProperties: true 
}

// Separated for more clarity
interface presentationRetrieved {
    requestId: string;
    requestStatus: "request_retrieved";
    state: string;
}
type presentationCallback = {
    requestId: string;
    requestStatus: "presentation_verified";
    state: string;
    subject: string;
    verifiedCredentialsData: Array<verifiableCredentials>;
    // contains info about VC submitted
} | presentationRetrieved | 
{
    requestId: string;
    requestStatus: "presentation_error";
    state: string;
    error: {
        message: string,
        code: string
    }
};

const presentationCallbackSchema: JSONSchemaType<presentationCallback> = {
    anyOf: [ {
        "$id": "schemas://presentationRetrieved",
        type: "object",
        required: ["requestId", "requestStatus"],
        additionalProperties: true,
        properties:{
            requestId: {type: "string"},
            state: {type: "string"},
            requestStatus: { enum: ["request_retrieved"], type:"string" },
        }
    }, {
        "$id": "schemas://presentationCallbackSuccess",
        type: "object",
        required: ["requestId", "requestStatus"],
        additionalProperties: true,
        properties:{
            requestId: {type: "string"},
            state: {type: "string"},
            subject: {type: "string"},
            requestStatus: { enum: ["presentation_verified"], type:"string" },
            verifiedCredentialsData: {type: "array", items: verifiableCredentialsSchema}
        }
    },
    {
        "$id": "schemas://presentationCallbackError",
        type: "object",
        required: ["requestId", "requestStatus", "error"],
        additionalProperties: true,
        properties:{
            requestId: {type: "string"},
            state: {type: "string"},
            requestStatus: { enum: ["presentation_error"], type:"string" },
            error: {
                type: "object",
                properties: {
                    message: {type: "string"},
                    code: {type: "string"}
                },
                required: ["code", "message"],
                additionalProperties: true
            }
        }
    }]
}

export {presentationCallback, verifiableCredentials, verifiableCredentialsSchema, presentationCallbackSchema}

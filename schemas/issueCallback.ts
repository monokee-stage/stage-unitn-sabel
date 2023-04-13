import { JSONSchemaType } from "ajv";

interface issueCallbackError {
    requestStatus: "issuance_error",
    requestId: string,
    state: string,
    "error": { code: string, message: string}
}

type issueCallback = {
    requestStatus: "request_retrieved" | "issuance_successful";
    requestId: string;
    state: string;
} | issueCallbackError

const issueCallbackSchema: JSONSchemaType<issueCallback> = {
    anyOf: [
        {
            type: "object",
            properties:{
                requestId: {type: "string"},
                state: {type: "string"},
                requestStatus: { enum: ["request_retrieved", "issuance_successful"], type:"string" }
            },
            required: ["requestId", "requestStatus"],
            additionalProperties: true 
        },
        {
            type: "object",
            properties: {        
                requestId: {type: "string"},
                state: {type: "string"},
                requestStatus: { enum: ["issuance_error"], type:"string"}, 
                "error": { type: "object", 
                            properties: { code: {type: "string"}, message: {type: "string"}},
                required: ["code", "message"], additionalProperties: false}
            
            },
            required: ["requestId", "requestStatus"],
            additionalProperties: true 
        }]
}

export {issueCallback, issueCallbackSchema}

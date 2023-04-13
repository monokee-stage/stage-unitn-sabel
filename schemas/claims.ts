import { JSONSchemaType } from "ajv"

type Claims = { // Employee credential
    username: string,
    firstname: string,
    lastname: string,
    email: string
} | { // Role credential
    role: string,
    revocationId: string
}; 

const claimsSchema: JSONSchemaType<Claims> = {
    "$id": "schemas://claims",
    oneOf: [{
            type: "object",
            properties: {
                firstname: {type: "string"},
                lastname: {type: "string"},
                email: {type: "string"},
                username: {type: "string"}
            },
            required: ["username"],
            additionalProperties: true 
        }, {
            type: "object",
            properties: {
                role: {type: "string"}, // TODO add enum
                revocationId: {type: "string"}
            },
            required: ["revocationId", "role"],
            additionalProperties: true 
        }
    ]
}

export {Claims, claimsSchema}

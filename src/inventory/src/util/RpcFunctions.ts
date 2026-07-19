import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js";
import { InventoryService } from "../service/inventory.js";
import type { movement_types } from "../generated/prisma/enums.js";

export interface params {
    product_id: string,
    quantity: number,
    reference_type: string,
    reference_id: string,
    type: movement_types
}

export interface response {
    success: boolean
}
export class Observer {
    constructor(private service: InventoryService) {
        this.service = service
    }

    // async addMoreStock(
    //     call: ServerUnaryCall<params, response>,
    //     callback: sendUnaryData<response>
    // ) {
    //     const result = await this.service.add_more_stock(
    //         call.request.product_id
    //     )

    //     callback(null, result)
    // }
    addMoreStock = async (call: ServerUnaryCall<params, response>) => {
        const result = await this.service.add_more_stock(call)
        console.log(result)
        return result
    }
}
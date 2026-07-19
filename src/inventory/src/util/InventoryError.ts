export default class InventoryError extends Error {
    public name: string;
    // public product_id: string;
    // public avalilable_stock: number
    constructor(message: string) {
        super(message);

        this.name = "InventoryError"
        // this.product_id = product_id
        // this.avalilable_stock = available_stock;

        Error.captureStackTrace(this, this.constructor)
    }
}
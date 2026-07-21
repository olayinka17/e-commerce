export default class InventoryError extends Error {
    public name: string;
    constructor(message: string) {
        super(message);

        this.name = "InventoryError"
        Error.captureStackTrace(this, this.constructor)
    }
}
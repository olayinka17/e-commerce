export const generateOTP = () => {
    const code: number = Math.floor(100000 + Math.random() * 900000)  
    // const expiry: Date = new Date(Date.now() + 10 * 60 * 1000)
    return code
}
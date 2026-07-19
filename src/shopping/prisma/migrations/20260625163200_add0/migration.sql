-- CreateTable
CREATE TABLE "PaymentOutox" (
    "id" TEXT NOT NULL,
    "aggregatetype" TEXT NOT NULL,
    "aggregateid" TEXT NOT NULL,
    "eventtype" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "PaymentOutox_pkey" PRIMARY KEY ("id")
);

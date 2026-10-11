-- Derived WebP thumbnails. Nullable, and existing photos keep working with no row.

CREATE TABLE "ImageVariant" (
    "sourceUrl" TEXT NOT NULL PRIMARY KEY,
    "thumb480" TEXT,
    "thumb960" TEXT,
    "longest" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

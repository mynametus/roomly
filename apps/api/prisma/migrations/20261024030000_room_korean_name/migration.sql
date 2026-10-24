ALTER TABLE "Room" ADD COLUMN "nameKo" TEXT;

UPDATE "Room" SET "nameKo" = '오키드 회의실' WHERE "name" = 'Orchid';
UPDATE "Room" SET "nameKo" = '로터스 회의실' WHERE "name" = 'Lotus';
UPDATE "Room" SET "nameKo" = '뱀부 회의실' WHERE "name" = 'Bamboo';

-- 012: Kişiye özel ödev + öğrenci onayı + teslim tarihi görüşmesi. Tekrar çalıştırılabilir (idempotent).
-- Ödev ya bir SINIFA (ClassId dolu, UserId NULL) ya da tek bir ÖĞRENCİYE (UserId dolu, ClassId NULL) verilir.
-- Kişisel ödev öğrenciyle birlikte taşınır: sınıf değiştirse de ödevi onunla kalır. Personelin kapsamı öğrencinin O ANKİ sınıfından hesaplanır.

-- 1) Sınıf kolonu boş olabilir (kişisel ödev). Üzerindeki indeks önce düşer, sonra yeniden kurulur.
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HW_Class' AND object_id = OBJECT_ID('dbo.Homework') AND has_filter = 0)
  DROP INDEX IX_HW_Class ON dbo.Homework;
GO
IF COLUMNPROPERTY(OBJECT_ID('dbo.Homework'), 'ClassId', 'AllowsNull') = 0
  ALTER TABLE dbo.Homework ALTER COLUMN ClassId INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HW_Class' AND object_id = OBJECT_ID('dbo.Homework'))
  CREATE INDEX IX_HW_Class ON dbo.Homework(ClassId, CreatedAt DESC) WHERE ClassId IS NOT NULL;
GO

-- 2) Kişisel ödevin sahibi + aynı Excel yüklemesinden çıkan ödevleri gruplayan paket kimliği.
-- UserId'ye CASCADE yok (Users→HomeworkDone ile Users→Homework→HomeworkItems→HomeworkDone çoklu kademeli silme yolu olur);
-- kullanıcı silen kodlar (admin, hesap silme) önce kişisel ödevini siler.
IF COL_LENGTH('dbo.Homework', 'UserId') IS NULL
  ALTER TABLE dbo.Homework ADD UserId INT NULL CONSTRAINT FK_HW_User REFERENCES dbo.Users(Id);
GO
IF COL_LENGTH('dbo.Homework', 'BatchId') IS NULL
  ALTER TABLE dbo.Homework ADD BatchId UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_HW_Target')
  ALTER TABLE dbo.Homework ADD CONSTRAINT CK_HW_Target CHECK ((ClassId IS NOT NULL AND UserId IS NULL) OR (ClassId IS NULL AND UserId IS NOT NULL));
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HW_User' AND object_id = OBJECT_ID('dbo.Homework'))
  CREATE INDEX IX_HW_User ON dbo.Homework(UserId, CreatedAt DESC) WHERE UserId IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HW_Batch' AND object_id = OBJECT_ID('dbo.Homework'))
  CREATE INDEX IX_HW_Batch ON dbo.Homework(BatchId) WHERE BatchId IS NOT NULL;
GO

-- 3) Öğrencinin "ödevi bitirdim" onayı (madde işaretlerinden ayrı; geri alınabilir)
IF OBJECT_ID(N'dbo.HomeworkSubmissions') IS NULL
CREATE TABLE dbo.HomeworkSubmissions (
  HomeworkId  INT NOT NULL CONSTRAINT FK_HWS_HW   REFERENCES dbo.Homework(Id) ON DELETE CASCADE,
  UserId      INT NOT NULL CONSTRAINT FK_HWS_User REFERENCES dbo.Users(Id)    ON DELETE CASCADE,
  SubmittedAt DATETIME2 NOT NULL CONSTRAINT DF_HWS_At DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_HomeworkSubmissions PRIMARY KEY (HomeworkId, UserId)
);
GO

-- 4) Öğrenciye özel teslim tarihi (öğretmenle anlaşılan yeni tarih). Yoksa Homework.DueDate geçerlidir.
IF OBJECT_ID(N'dbo.HomeworkDue') IS NULL
CREATE TABLE dbo.HomeworkDue (
  HomeworkId INT NOT NULL CONSTRAINT FK_HWDU_HW   REFERENCES dbo.Homework(Id) ON DELETE CASCADE,
  UserId     INT NOT NULL CONSTRAINT FK_HWDU_User REFERENCES dbo.Users(Id)    ON DELETE CASCADE,
  DueDate    DATE NOT NULL,
  SetAt      DATETIME2 NOT NULL CONSTRAINT DF_HWDU_At DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_HomeworkDue PRIMARY KEY (HomeworkId, UserId)
);
GO

-- 5) Öğrenci ↔ öğretmen yazışması: not, tarih talebi (request), kabul/ret, öğretmenin belirlediği tarih.
-- Kind: msg | request | accept | reject | set. UserId her zaman ÖĞRENCİ; AuthorRole yazanı gösterir.
IF OBJECT_ID(N'dbo.HomeworkThread') IS NULL
CREATE TABLE dbo.HomeworkThread (
  Id          INT IDENTITY(1,1) PRIMARY KEY,
  HomeworkId  INT NOT NULL CONSTRAINT FK_HWT_HW   REFERENCES dbo.Homework(Id) ON DELETE CASCADE,
  UserId      INT NOT NULL CONSTRAINT FK_HWT_User REFERENCES dbo.Users(Id)    ON DELETE CASCADE,
  AuthorId    INT NULL,
  AuthorRole  VARCHAR(10) NOT NULL CONSTRAINT CK_HWT_Role CHECK (AuthorRole IN ('student','staff')),
  Kind        VARCHAR(10) NOT NULL CONSTRAINT CK_HWT_Kind CHECK (Kind IN ('msg','request','accept','reject','set')),
  Body        NVARCHAR(500) NULL,
  ProposedDue DATE NULL,
  CreatedAt   DATETIME2 NOT NULL CONSTRAINT DF_HWT_At DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HWT_HW_User' AND object_id = OBJECT_ID('dbo.HomeworkThread'))
  CREATE INDEX IX_HWT_HW_User ON dbo.HomeworkThread(HomeworkId, UserId, Id);
GO

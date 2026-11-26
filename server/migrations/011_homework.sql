-- 011: Haftalık ödev (kurum). Sınıfa verilir; maddeleri (konu + hedef soru) vardır; isteğe bağlı dosya eki (xlsx/pdf); öğrenci maddeleri işaretler.
IF OBJECT_ID(N'dbo.Homework') IS NULL
CREATE TABLE dbo.Homework (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  InstitutionId INT NOT NULL CONSTRAINT FK_HW_Inst  REFERENCES dbo.Institutions(Id),
  ClassId       INT NOT NULL CONSTRAINT FK_HW_Class REFERENCES dbo.Classes(Id),
  CreatedBy     INT NULL,   -- yalnızca bilgi (FK yok: kullanıcı silinince çoklu kademeli silme yolu oluşmasın)
  Title         NVARCHAR(120) NOT NULL,
  Note          NVARCHAR(1000) NULL,
  DueDate       DATE NULL,
  FileName      NVARCHAR(100) NULL,
  FileType      VARCHAR(80) NULL,
  FileData      VARBINARY(MAX) NULL,
  CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_HW_Created DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HW_Class')
  CREATE INDEX IX_HW_Class ON dbo.Homework(ClassId, CreatedAt DESC);
GO
IF OBJECT_ID(N'dbo.HomeworkItems') IS NULL
CREATE TABLE dbo.HomeworkItems (
  Id         INT IDENTITY(1,1) PRIMARY KEY,
  HomeworkId INT NOT NULL CONSTRAINT FK_HWI_HW REFERENCES dbo.Homework(Id) ON DELETE CASCADE,
  Pos        INT NOT NULL,
  Topic      NVARCHAR(150) NOT NULL,
  Target     INT NULL CONSTRAINT CK_HWI_Target CHECK (Target IS NULL OR Target BETWEEN 1 AND 5000)
);
GO
IF OBJECT_ID(N'dbo.HomeworkDone') IS NULL
CREATE TABLE dbo.HomeworkDone (
  ItemId INT NOT NULL CONSTRAINT FK_HWD_Item REFERENCES dbo.HomeworkItems(Id) ON DELETE CASCADE,
  UserId INT NOT NULL CONSTRAINT FK_HWD_User REFERENCES dbo.Users(Id) ON DELETE CASCADE,
  DoneAt DATETIME2 NOT NULL CONSTRAINT DF_HWD_At DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_HomeworkDone PRIMARY KEY (ItemId, UserId)
);
GO

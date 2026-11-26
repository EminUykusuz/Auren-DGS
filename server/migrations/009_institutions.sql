-- 009: Kurum (dershane) paneli — idempotent. Çalıştırmadan önce VERİTABANI YEDEĞİ alın.
-- Mevcut bireysel kullanıcılar etkilenmez: InstitutionId NULL, Role 'student' kalır.

-- 1) Kurumlar (logo DB'de; yalnızca png/jpeg/webp, sunucu doğrular)
IF OBJECT_ID(N'dbo.Institutions') IS NULL
CREATE TABLE dbo.Institutions (
  Id           INT IDENTITY(1,1) PRIMARY KEY,
  Name         NVARCHAR(100) NOT NULL,
  Slug         VARCHAR(40)   NOT NULL,
  PrimaryColor CHAR(7)       NULL,
  LogoData     VARBINARY(MAX) NULL,
  LogoType     VARCHAR(20)   NULL,
  LogoVersion  INT           NOT NULL CONSTRAINT DF_Inst_LogoVer DEFAULT 0,
  StudentLimit INT           NULL,
  ExamTrack    VARCHAR(4)    NOT NULL CONSTRAINT DF_Inst_Track DEFAULT 'BOTH',   -- öğrencileri hangi sınava hazırlıyor (LGS fazında genişletilir)
  IsActive     BIT           NOT NULL CONSTRAINT DF_Inst_Active DEFAULT 1,
  CreatedAt    DATETIME2     NOT NULL CONSTRAINT DF_Inst_Created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Inst_Slug UNIQUE (Slug),
  CONSTRAINT CK_Inst_Track CHECK (ExamTrack IN ('DGS','YKS','BOTH')),
  CONSTRAINT CK_Inst_Color CHECK (PrimaryColor IS NULL OR PrimaryColor LIKE '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);
GO

-- 2) Sınıflar
IF OBJECT_ID(N'dbo.Classes') IS NULL
CREATE TABLE dbo.Classes (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  InstitutionId INT NOT NULL CONSTRAINT FK_Cls_Inst REFERENCES dbo.Institutions(Id),
  Name          NVARCHAR(40) NOT NULL,
  IsArchived    BIT NOT NULL CONSTRAINT DF_Cls_Arch DEFAULT 0,
  CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_Cls_Created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Cls_Name UNIQUE (InstitutionId, Name)
);
GO

-- 3) Kullanıcı: kurum, rol, sınıf, öğrenci no, ilk girişte şifre değiştirme
IF COL_LENGTH('dbo.Users', 'InstitutionId') IS NULL
  ALTER TABLE dbo.Users ADD InstitutionId INT NULL CONSTRAINT FK_Users_Inst REFERENCES dbo.Institutions(Id);
GO
IF COL_LENGTH('dbo.Users', 'Role') IS NULL
  ALTER TABLE dbo.Users ADD Role VARCHAR(10) NOT NULL CONSTRAINT DF_Users_Role DEFAULT 'student';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_Role')
  ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_Role CHECK (Role IN ('student','teacher','owner'));
GO
IF COL_LENGTH('dbo.Users', 'ClassId') IS NULL
  ALTER TABLE dbo.Users ADD ClassId INT NULL CONSTRAINT FK_Users_Class REFERENCES dbo.Classes(Id);
GO
IF COL_LENGTH('dbo.Users', 'StudentNo') IS NULL
  ALTER TABLE dbo.Users ADD StudentNo NVARCHAR(20) NULL;
GO
IF COL_LENGTH('dbo.Users', 'MustChangePassword') IS NULL
  ALTER TABLE dbo.Users ADD MustChangePassword BIT NOT NULL CONSTRAINT DF_Users_MCP DEFAULT 0;
GO
-- Kurum dışı kullanıcı öğretmen/yönetici olamaz; kurumlu kullanıcı bir kuruma bağlıdır
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_RoleInst')
  ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_RoleInst CHECK (Role = 'student' OR InstitutionId IS NOT NULL);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Users_Inst_StudentNo')
  CREATE UNIQUE INDEX UX_Users_Inst_StudentNo ON dbo.Users(InstitutionId, StudentNo) WHERE InstitutionId IS NOT NULL AND StudentNo IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_Inst_Class')
  CREATE INDEX IX_Users_Inst_Class ON dbo.Users(InstitutionId, ClassId) WHERE InstitutionId IS NOT NULL;
GO

-- 4) Öğretmen ↔ sınıf ataması
IF OBJECT_ID(N'dbo.TeacherClasses') IS NULL
CREATE TABLE dbo.TeacherClasses (
  TeacherId INT NOT NULL CONSTRAINT FK_TC_Teacher REFERENCES dbo.Users(Id) ON DELETE CASCADE,
  ClassId   INT NOT NULL CONSTRAINT FK_TC_Class REFERENCES dbo.Classes(Id),
  CONSTRAINT PK_TeacherClasses PRIMARY KEY (TeacherId, ClassId)
);
GO

-- 5) Sınıf değiştirme geçmişi (silinmez; kim, ne zaman, neden)
IF OBJECT_ID(N'dbo.ClassTransfers') IS NULL
CREATE TABLE dbo.ClassTransfers (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  InstitutionId INT NOT NULL CONSTRAINT FK_CT_Inst REFERENCES dbo.Institutions(Id),
  UserId        INT NOT NULL CONSTRAINT FK_CT_User REFERENCES dbo.Users(Id) ON DELETE CASCADE,
  FromClassId   INT NULL CONSTRAINT FK_CT_From REFERENCES dbo.Classes(Id),
  ToClassId     INT NULL CONSTRAINT FK_CT_To REFERENCES dbo.Classes(Id),
  MovedBy       INT NULL,
  Reason        NVARCHAR(200) NULL,
  MovedAt       DATETIME2 NOT NULL CONSTRAINT DF_CT_At DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CT_User')
  CREATE INDEX IX_CT_User ON dbo.ClassTransfers(UserId, MovedAt);
GO

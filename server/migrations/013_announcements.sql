-- 013: Duyuru panosu (kurum). Tüm kuruma (ClassId NULL) ya da bir sınıfa yazılır; öğrenci okundu işaretler.
-- Çoklu kademeli silme yolu oluşmasın diye ClassId'de CASCADE yok (sınıf silinmez, arşivlenir), AuthorId ve okuma kaydındaki UserId'de FK yok.
IF OBJECT_ID(N'dbo.Announcements') IS NULL
CREATE TABLE dbo.Announcements (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  InstitutionId INT NOT NULL CONSTRAINT FK_Ann_Inst  REFERENCES dbo.Institutions(Id) ON DELETE CASCADE,
  ClassId       INT NULL     CONSTRAINT FK_Ann_Class REFERENCES dbo.Classes(Id),
  AuthorId      INT NULL,
  AuthorName    NVARCHAR(80) NULL,
  Title         NVARCHAR(120) NOT NULL,
  Body          NVARCHAR(2000) NOT NULL,
  ExpiresAt     DATE NULL,
  CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_Ann_At DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Ann_Inst' AND object_id = OBJECT_ID(N'dbo.Announcements'))
  CREATE INDEX IX_Ann_Inst ON dbo.Announcements(InstitutionId, CreatedAt DESC);
GO
IF OBJECT_ID(N'dbo.AnnouncementReads') IS NULL
CREATE TABLE dbo.AnnouncementReads (
  AnnouncementId INT NOT NULL CONSTRAINT FK_AnnR_Ann REFERENCES dbo.Announcements(Id) ON DELETE CASCADE,
  UserId         INT NOT NULL,
  ReadAt         DATETIME2 NOT NULL CONSTRAINT DF_AnnR_At DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_AnnR PRIMARY KEY (AnnouncementId, UserId)
);
GO

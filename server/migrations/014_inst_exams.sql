-- 014: Kurum denemeleri. Öğretmen/yönetici deneme tanımlar, sonuçları toplu girer; sonuçlar öğrencilerin kendi
-- Denemeler listesine (TrialExams) düşer ve InstExamId ile kurum denemesi olarak işaretlenir.
-- ClassId NULL = tüm kurum (yalnız yönetici). Sınıf silinmez (arşivlenir), bu yüzden ClassId'de CASCADE yok.
IF OBJECT_ID(N'dbo.InstExams') IS NULL
CREATE TABLE dbo.InstExams (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  InstitutionId INT NOT NULL CONSTRAINT FK_IE_Inst  REFERENCES dbo.Institutions(Id) ON DELETE CASCADE,
  ClassId       INT NULL     CONSTRAINT FK_IE_Class REFERENCES dbo.Classes(Id),
  ExamType      VARCHAR(3) NOT NULL,
  ExamPart      VARCHAR(3) NOT NULL,
  ExamName      NVARCHAR(60) NOT NULL,
  ExamDate      DATE NOT NULL,
  CreatedBy     INT NULL,
  CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_IE_At DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_IE_Inst' AND object_id = OBJECT_ID(N'dbo.InstExams'))
  CREATE INDEX IX_IE_Inst ON dbo.InstExams(InstitutionId, ExamDate DESC);
GO
IF COL_LENGTH('dbo.TrialExams', 'InstExamId') IS NULL
  ALTER TABLE dbo.TrialExams ADD InstExamId INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TE_InstExam' AND object_id = OBJECT_ID(N'dbo.TrialExams'))
  CREATE INDEX IX_TE_InstExam ON dbo.TrialExams(InstExamId) WHERE InstExamId IS NOT NULL;
GO

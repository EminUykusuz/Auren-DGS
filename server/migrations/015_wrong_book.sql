-- 015: Yanlış defteri. Öğrenci yanlış yaptığı sorunun fotoğrafını (istemcide küçültülmüş JPEG, en çok ~300 KB) ders/konu/nedenle saklar.
-- Fotoğraf yalnız sahibine, kimlik doğrulamalı uçtan servis edilir.
IF OBJECT_ID(N'dbo.WrongQuestions') IS NULL
CREATE TABLE dbo.WrongQuestions (
  Id        INT IDENTITY(1,1) PRIMARY KEY,
  UserId    INT NOT NULL CONSTRAINT FK_WQ_User REFERENCES dbo.Users(Id) ON DELETE CASCADE,
  ExamType  VARCHAR(3) NOT NULL,
  ExamPart  VARCHAR(3) NULL,
  Subject   VARCHAR(20) NOT NULL,
  Topic     NVARCHAR(80) NULL,
  Reason    VARCHAR(12) NULL,
  Note      NVARCHAR(500) NULL,
  Photo     VARBINARY(MAX) NULL,
  PhotoMime VARCHAR(20) NULL,
  IsSolved  BIT NOT NULL CONSTRAINT DF_WQ_Solved DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_WQ_At DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_WQ_User' AND object_id = OBJECT_ID(N'dbo.WrongQuestions'))
  CREATE INDEX IX_WQ_User ON dbo.WrongQuestions(UserId, IsSolved, CreatedAt DESC);
GO

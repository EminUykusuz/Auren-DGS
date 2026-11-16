-- 007: hesap türü (DGS | YKS | BOTH) ve yeni hata nedeni "islem" (işlem hatası). Tekrar çalıştırılabilir (idempotent).
IF COL_LENGTH('dbo.Users','ExamTrack') IS NULL
  ALTER TABLE dbo.Users ADD ExamTrack VARCHAR(4) NOT NULL CONSTRAINT DF_Users_ExamTrack DEFAULT 'BOTH';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_Users_ExamTrack')
  ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_ExamTrack CHECK (ExamTrack IN ('DGS','YKS','BOTH'));
GO
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_TEE_Reason' AND definition NOT LIKE '%islem%')
  ALTER TABLE dbo.TrialExamErrors DROP CONSTRAINT CK_TEE_Reason;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_TEE_Reason')
  ALTER TABLE dbo.TrialExamErrors ADD CONSTRAINT CK_TEE_Reason CHECK (Reason IN ('dikkat','islem','konu','sure','formul','diger'));
GO

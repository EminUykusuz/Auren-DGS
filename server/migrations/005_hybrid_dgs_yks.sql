-- 005: Auren hibrit (DGS + YKS) — idempotent; her batch tekrar çalıştırılabilir.
-- Net kuralı (DGS, TYT, AYT): 4 yanlış 1 doğruyu götürür → Net = Doğru − Yanlış/4.
-- Çalıştırma: npm run migrate  (schema.sql sonrası migrations/*.sql sırayla uygulanır)

-- 1) Kullanıcı: tercih edilen mod + YKS sınav tarihi (mevcut ExamDate DGS tarihi olarak kalır)
IF COL_LENGTH('dbo.Users', 'ExamMode') IS NULL
  ALTER TABLE dbo.Users ADD ExamMode VARCHAR(3) NOT NULL CONSTRAINT DF_Users_ExamMode DEFAULT 'DGS',
    CONSTRAINT CK_Users_ExamMode CHECK (ExamMode IN ('DGS','YKS'));
GO
IF COL_LENGTH('dbo.Users', 'YksExamDate') IS NULL
  ALTER TABLE dbo.Users ADD YksExamDate DATE NULL;
GO

-- 2) Denemeler: sınav türü + bölüm (DGS | TYT | AYT) + toplam net
IF COL_LENGTH('dbo.TrialExams', 'ExamType') IS NULL
  ALTER TABLE dbo.TrialExams ADD ExamType VARCHAR(3) NOT NULL CONSTRAINT DF_TE_Type DEFAULT 'DGS',
    ExamPart VARCHAR(3) NOT NULL CONSTRAINT DF_TE_Part DEFAULT 'DGS', TotalNet DECIMAL(7,2) NULL;
GO
-- Eski sabit sütun kısıtları (yalnızca matematik/türkçe) kaldırılır; yerini TrialExamSections alır
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_TE_Math')      ALTER TABLE dbo.TrialExams DROP CONSTRAINT CK_TE_Math;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_TE_Turkce')    ALTER TABLE dbo.TrialExams DROP CONSTRAINT CK_TE_Turkce;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_TE_MathNet')   ALTER TABLE dbo.TrialExams DROP CONSTRAINT CK_TE_MathNet;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_TE_TurkceNet') ALTER TABLE dbo.TrialExams DROP CONSTRAINT CK_TE_TurkceNet;
GO
DECLARE @c sysname, @sql nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrialExams') AND is_nullable = 0
    AND name IN ('MathCorrect','MathWrong','MathNet','TurkceCorrect','TurkceWrong','TurkceNet');
OPEN cur; FETCH NEXT FROM cur INTO @c;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @sql = N'ALTER TABLE dbo.TrialExams ALTER COLUMN ' + QUOTENAME(@c) + CASE WHEN @c LIKE '%Net' THEN N' DECIMAL(6,2) NULL' ELSE N' INT NULL' END;
  EXEC sp_executesql @sql;
  FETCH NEXT FROM cur INTO @c;
END
CLOSE cur; DEALLOCATE cur;
GO
UPDATE dbo.TrialExams SET TotalNet = MathNet + TurkceNet WHERE TotalNet IS NULL AND MathNet IS NOT NULL AND TurkceNet IS NOT NULL;
GO
IF COLUMNPROPERTY(OBJECT_ID('dbo.TrialExams'), 'TotalNet', 'AllowsNull') = 1
  ALTER TABLE dbo.TrialExams ALTER COLUMN TotalNet DECIMAL(7,2) NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_TE_Part')
  ALTER TABLE dbo.TrialExams ADD CONSTRAINT CK_TE_Part CHECK (
    (ExamType = 'DGS' AND ExamPart = 'DGS') OR (ExamType = 'YKS' AND ExamPart IN ('TYT','AYT')));
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TE_User_Type_Date')
  CREATE INDEX IX_TE_User_Type_Date ON dbo.TrialExams(UserId, ExamType, ExamDate);
GO

-- 3) Bölüm bazlı sonuçlar (DGS: matematik, turkce · TYT: turkce, sosyal, matematik, fen · AYT: ...)
IF OBJECT_ID(N'dbo.TrialExamSections') IS NULL
CREATE TABLE dbo.TrialExamSections (
  Id         INT IDENTITY(1,1) PRIMARY KEY,
  ExamId     INT NOT NULL CONSTRAINT FK_TES_Exam REFERENCES dbo.TrialExams(Id) ON DELETE CASCADE,
  SectionKey VARCHAR(10) NOT NULL,
  Correct    INT NOT NULL,
  Wrong      INT NOT NULL,
  Net        DECIMAL(6,2) NOT NULL,
  CONSTRAINT CK_TES_Counts CHECK (Correct >= 0 AND Wrong >= 0 AND Correct + Wrong <= 120),
  -- 4 yanlış 1 doğru: DB seviyesinde ikinci güvence
  CONSTRAINT CK_TES_Net CHECK (Net = Correct - Wrong * 0.25),
  CONSTRAINT UQ_TES UNIQUE (ExamId, SectionKey)
);
GO
-- Mevcut DGS denemelerini bölümlere taşı
INSERT INTO dbo.TrialExamSections (ExamId, SectionKey, Correct, Wrong, Net)
SELECT e.Id, 'matematik', e.MathCorrect, e.MathWrong, e.MathNet FROM dbo.TrialExams e
WHERE e.MathCorrect IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.TrialExamSections s WHERE s.ExamId = e.Id AND s.SectionKey = 'matematik');
INSERT INTO dbo.TrialExamSections (ExamId, SectionKey, Correct, Wrong, Net)
SELECT e.Id, 'turkce', e.TurkceCorrect, e.TurkceWrong, e.TurkceNet FROM dbo.TrialExams e
WHERE e.TurkceCorrect IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.TrialExamSections s WHERE s.ExamId = e.Id AND s.SectionKey = 'turkce');
GO

-- 4) Hata nedenleri: ders anahtarı artık bölüm anahtarı (sosyal, fen, edebiyat, ...)
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_TEE_Subject')
  ALTER TABLE dbo.TrialExamErrors DROP CONSTRAINT CK_TEE_Subject;
GO

-- 5) Çalışma oturumları + konu ilerlemesi: sınav türü
IF COL_LENGTH('dbo.StudySessions', 'ExamType') IS NULL
  ALTER TABLE dbo.StudySessions ADD ExamType VARCHAR(3) NOT NULL CONSTRAINT DF_SS_Type DEFAULT 'DGS',
    CONSTRAINT CK_SS_Type CHECK (ExamType IN ('DGS','YKS'));
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SS_User_Type_Date')
  CREATE INDEX IX_SS_User_Type_Date ON dbo.StudySessions(UserId, ExamType, StudyDate);
GO
IF COL_LENGTH('dbo.SubjectProgress', 'ExamType') IS NULL
  ALTER TABLE dbo.SubjectProgress ADD ExamType VARCHAR(3) NOT NULL CONSTRAINT DF_SP_Type DEFAULT 'DGS',
    CONSTRAINT CK_SP_Type CHECK (ExamType IN ('DGS','YKS'));
GO
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_SP')
  ALTER TABLE dbo.SubjectProgress DROP CONSTRAINT UQ_SP;
GO
-- Yalnızca 008'den ÖNCE kurulur: 008 bu kısıtı bölüm bazlı UQ_SP_Part ile değiştirir. Migration'lar her deploy'da yeniden çalıştığı için
-- bu koşul olmazsa aynı konu TYT ve AYT'de çalışılmışken (iki satır) eski kısıt kurulamaz ve deploy düşer.
IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_SP_Type') AND COL_LENGTH('dbo.SubjectProgress', 'ExamPart') IS NULL
  ALTER TABLE dbo.SubjectProgress ADD CONSTRAINT UQ_SP_Type UNIQUE (UserId, ExamType, SubjectKey, TopicKey);
GO

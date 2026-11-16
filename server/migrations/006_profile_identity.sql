-- 006: profil kimliği — ad soyad + avatar (hazır avatar adresi; sunucu izin verilen kalıpla doğrular)
IF COL_LENGTH('dbo.Users', 'FullName') IS NULL
  ALTER TABLE dbo.Users ADD FullName NVARCHAR(80) NULL;
GO
IF COL_LENGTH('dbo.Users', 'AvatarUrl') IS NULL
  ALTER TABLE dbo.Users ADD AvatarUrl VARCHAR(200) NULL;
GO
IF COL_LENGTH('dbo.Users', 'ProfileUpdatedAt') IS NULL
  ALTER TABLE dbo.Users ADD ProfileUpdatedAt DATETIME2 NULL;
GO

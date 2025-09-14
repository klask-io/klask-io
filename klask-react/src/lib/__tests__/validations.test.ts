import { describe, it, expect } from 'vitest';
import { 
  createUserSchema, 
  updateUserSchema, 
  type CreateUserForm, 
  type UpdateUserForm 
} from '../validations';

describe('User Validation Schemas', () => {
  describe('createUserSchema', () => {
    describe('Valid Data', () => {
      it('should validate complete valid user data', () => {
        const validData: CreateUserForm = {
          username: 'testuser123',
          email: 'test@example.com',
          password: 'Password123',
          role: 'User',
          active: true,
        };

        const result = createUserSchema.parse(validData);
        expect(result).toEqual(validData);
      });

      it('should use default values when optional fields are missing', () => {
        const minimalData = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password123',
        };

        const result = createUserSchema.parse(minimalData);
        expect(result).toEqual({
          ...minimalData,
          role: 'User',
          active: true,
        });
      });

      it('should accept Admin role', () => {
        const validData = {
          username: 'admin',
          email: 'admin@example.com',
          password: 'AdminPass123',
          role: 'Admin' as const,
          active: true,
        };

        const result = createUserSchema.parse(validData);
        expect(result.role).toBe('Admin');
      });

      it('should accept false for active field', () => {
        const validData = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password123',
          role: 'User' as const,
          active: false,
        };

        const result = createUserSchema.parse(validData);
        expect(result.active).toBe(false);
      });
    });

    describe('Username Validation', () => {
      const baseData = {
        email: 'test@example.com',
        password: 'Password123',
        role: 'User' as const,
        active: true,
      };

      it('should reject empty username', () => {
        expect(() => 
          createUserSchema.parse({ ...baseData, username: '' })
        ).toThrow('Username is required');
      });

      it('should reject username shorter than 3 characters', () => {
        expect(() => 
          createUserSchema.parse({ ...baseData, username: 'ab' })
        ).toThrow('Username must be at least 3 characters');
      });

      it('should reject username with special characters', () => {
        expect(() => 
          createUserSchema.parse({ ...baseData, username: 'user@name!' })
        ).toThrow('Username can only contain letters, numbers, underscores, and hyphens');
      });

      it('should accept username with underscores and hyphens', () => {
        const validUsernames = ['user_name', 'user-name', 'user123', 'USER_NAME'];
        
        validUsernames.forEach(username => {
          const result = createUserSchema.parse({ ...baseData, username });
          expect(result.username).toBe(username);
        });
      });

      it('should reject username with spaces', () => {
        expect(() => 
          createUserSchema.parse({ ...baseData, username: 'user name' })
        ).toThrow('Username can only contain letters, numbers, underscores, and hyphens');
      });
    });

    describe('Email Validation', () => {
      const baseData = {
        username: 'testuser',
        password: 'Password123',
        role: 'User' as const,
        active: true,
      };

      it('should reject empty email', () => {
        expect(() => 
          createUserSchema.parse({ ...baseData, email: '' })
        ).toThrow('Email is required');
      });

      it('should reject invalid email format', () => {
        const invalidEmails = [
          'invalid-email',
          'user@',
          '@domain.com',
          'user.domain.com',
          'user..double@domain.com',
        ];

        invalidEmails.forEach(email => {
          expect(() => 
            createUserSchema.parse({ ...baseData, email })
          ).toThrow('Please enter a valid email address');
        });
      });

      it('should accept valid email formats', () => {
        const validEmails = [
          'test@example.com',
          'user+tag@domain.co.uk',
          'first.last@subdomain.example.org',
          'user123@test-domain.com',
        ];

        validEmails.forEach(email => {
          const result = createUserSchema.parse({ ...baseData, email });
          expect(result.email).toBe(email);
        });
      });
    });

    describe('Password Validation', () => {
      const baseData = {
        username: 'testuser',
        email: 'test@example.com',
        role: 'User' as const,
        active: true,
      };

      it('should reject empty password', () => {
        expect(() => 
          createUserSchema.parse({ ...baseData, password: '' })
        ).toThrow('Password is required');
      });

      it('should reject password shorter than 8 characters', () => {
        expect(() => 
          createUserSchema.parse({ ...baseData, password: 'Pass1' })
        ).toThrow('Password must be at least 8 characters');
      });

      it('should reject password without lowercase letter', () => {
        expect(() => 
          createUserSchema.parse({ ...baseData, password: 'PASSWORD123' })
        ).toThrow('Password must contain at least one lowercase letter, one uppercase letter, and one number');
      });

      it('should reject password without uppercase letter', () => {
        expect(() => 
          createUserSchema.parse({ ...baseData, password: 'password123' })
        ).toThrow('Password must contain at least one lowercase letter, one uppercase letter, and one number');
      });

      it('should reject password without number', () => {
        expect(() => 
          createUserSchema.parse({ ...baseData, password: 'Password' })
        ).toThrow('Password must contain at least one lowercase letter, one uppercase letter, and one number');
      });

      it('should accept valid passwords', () => {
        const validPasswords = [
          'Password123',
          'MySecure1Pass',
          'Test123Password',
          'Complex1Password!',
        ];

        validPasswords.forEach(password => {
          const result = createUserSchema.parse({ ...baseData, password });
          expect(result.password).toBe(password);
        });
      });
    });

    describe('Role Validation', () => {
      const baseData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        active: true,
      };

      it('should reject invalid role', () => {
        expect(() => 
          createUserSchema.parse({ ...baseData, role: 'InvalidRole' as any })
        ).toThrow();
      });

      it('should accept valid roles', () => {
        const validRoles = ['User', 'Admin'] as const;
        
        validRoles.forEach(role => {
          const result = createUserSchema.parse({ ...baseData, role });
          expect(result.role).toBe(role);
        });
      });
    });
  });

  describe('updateUserSchema', () => {
    describe('Valid Data', () => {
      it('should validate complete valid update data', () => {
        const validData: UpdateUserForm = {
          username: 'updateduser',
          email: 'updated@example.com',
          password: 'NewPassword123',
          role: 'Admin',
          active: false,
        };

        const result = updateUserSchema.parse(validData);
        expect(result).toEqual(validData);
      });

      it('should accept partial update data', () => {
        const partialData = {
          username: 'newusername',
        };

        const result = updateUserSchema.parse(partialData);
        expect(result).toEqual(partialData);
      });

      it('should accept empty object for update', () => {
        const result = updateUserSchema.parse({});
        expect(result).toEqual({});
      });
    });

    describe('Username Validation', () => {
      it('should reject username shorter than 3 characters', () => {
        expect(() => 
          updateUserSchema.parse({ username: 'ab' })
        ).toThrow('Username must be at least 3 characters');
      });

      it('should reject username with special characters', () => {
        expect(() => 
          updateUserSchema.parse({ username: 'user@name!' })
        ).toThrow('Username can only contain letters, numbers, underscores, and hyphens');
      });

      it('should accept valid username formats', () => {
        const validUsernames = ['user_name', 'user-name', 'user123'];
        
        validUsernames.forEach(username => {
          const result = updateUserSchema.parse({ username });
          expect(result.username).toBe(username);
        });
      });

      it('should not require username field', () => {
        const result = updateUserSchema.parse({});
        expect(result).not.toHaveProperty('username');
      });
    });

    describe('Email Validation', () => {
      it('should reject invalid email format', () => {
        const invalidEmails = [
          'invalid-email',
          'user@',
          '@domain.com',
        ];

        invalidEmails.forEach(email => {
          expect(() => 
            updateUserSchema.parse({ email })
          ).toThrow('Please enter a valid email address');
        });
      });

      it('should accept valid email formats', () => {
        const validEmails = [
          'test@example.com',
          'user+tag@domain.co.uk',
          'first.last@subdomain.example.org',
        ];

        validEmails.forEach(email => {
          const result = updateUserSchema.parse({ email });
          expect(result.email).toBe(email);
        });
      });

      it('should not require email field', () => {
        const result = updateUserSchema.parse({});
        expect(result).not.toHaveProperty('email');
      });
    });

    describe('Password Validation', () => {
      it('should reject password shorter than 8 characters', () => {
        expect(() => 
          updateUserSchema.parse({ password: 'Pass1' })
        ).toThrow('Password must be at least 8 characters');
      });

      it('should reject password without complexity requirements', () => {
        const weakPasswords = [
          'password',     // no uppercase or number
          'PASSWORD',     // no lowercase or number
          'Password',     // no number
          '12345678',     // no letters
        ];

        weakPasswords.forEach(password => {
          expect(() => 
            updateUserSchema.parse({ password })
          ).toThrow('Password must contain at least one lowercase letter, one uppercase letter, and one number');
        });
      });

      it('should accept strong passwords', () => {
        const strongPasswords = [
          'NewPassword123',
          'Updated1Pass',
          'Complex2Password!',
        ];

        strongPasswords.forEach(password => {
          const result = updateUserSchema.parse({ password });
          expect(result.password).toBe(password);
        });
      });

      it('should not require password field', () => {
        const result = updateUserSchema.parse({});
        expect(result).not.toHaveProperty('password');
      });
    });

    describe('Role Validation', () => {
      it('should accept valid roles', () => {
        const validRoles = ['User', 'Admin'] as const;
        
        validRoles.forEach(role => {
          const result = updateUserSchema.parse({ role });
          expect(result.role).toBe(role);
        });
      });

      it('should reject invalid role', () => {
        expect(() => 
          updateUserSchema.parse({ role: 'InvalidRole' as any })
        ).toThrow();
      });

      it('should not require role field', () => {
        const result = updateUserSchema.parse({});
        expect(result).not.toHaveProperty('role');
      });
    });

    describe('Active Status Validation', () => {
      it('should accept boolean values for active', () => {
        const result1 = updateUserSchema.parse({ active: true });
        expect(result1.active).toBe(true);

        const result2 = updateUserSchema.parse({ active: false });
        expect(result2.active).toBe(false);
      });

      it('should reject non-boolean values for active', () => {
        expect(() => 
          updateUserSchema.parse({ active: 'true' as any })
        ).toThrow();

        expect(() => 
          updateUserSchema.parse({ active: 1 as any })
        ).toThrow();
      });

      it('should not require active field', () => {
        const result = updateUserSchema.parse({});
        expect(result).not.toHaveProperty('active');
      });
    });
  });

  describe('Schema Differences', () => {
    it('should require different fields in create vs update', () => {
      // Create schema requires username, email, password
      expect(() => 
        createUserSchema.parse({ email: 'test@example.com', password: 'Password123' })
      ).toThrow();

      expect(() => 
        createUserSchema.parse({ username: 'test', password: 'Password123' })
      ).toThrow();

      expect(() => 
        createUserSchema.parse({ username: 'test', email: 'test@example.com' })
      ).toThrow();

      // Update schema doesn't require any fields
      expect(() => 
        updateUserSchema.parse({})
      ).not.toThrow();
    });

    it('should have same validation rules for common fields', () => {
      const testData = {
        username: 'ab', // Too short
        email: 'invalid-email',
        password: 'weak',
      };

      // Both schemas should reject the same invalid data
      expect(() => createUserSchema.parse(testData)).toThrow();
      expect(() => updateUserSchema.parse(testData)).toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should infer correct types for CreateUserForm', () => {
      const createData: CreateUserForm = {
        username: 'test',
        email: 'test@example.com',
        password: 'Password123',
        role: 'User',
        active: true,
      };

      // TypeScript compilation success indicates correct typing
      expect(createData.username).toBeDefined();
      expect(createData.email).toBeDefined();
      expect(createData.password).toBeDefined();
      expect(createData.role).toBeDefined();
      expect(createData.active).toBeDefined();
    });

    it('should infer correct types for UpdateUserForm', () => {
      const updateData: UpdateUserForm = {
        username: 'test',
        // Other fields are optional
      };

      // TypeScript compilation success indicates correct typing
      expect(updateData.username).toBeDefined();
      expect(updateData.email).toBeUndefined();
      expect(updateData.password).toBeUndefined();
      expect(updateData.role).toBeUndefined();
      expect(updateData.active).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle whitespace-only strings', () => {
      expect(() => 
        createUserSchema.parse({ username: '   ', email: 'test@example.com', password: 'Password123' })
      ).toThrow();

      expect(() => 
        createUserSchema.parse({ username: 'test', email: '   ', password: 'Password123' })
      ).toThrow();

      expect(() => 
        createUserSchema.parse({ username: 'test', email: 'test@example.com', password: '   ' })
      ).toThrow();
    });

    it('should handle null and undefined values', () => {
      expect(() => 
        createUserSchema.parse({ username: null, email: 'test@example.com', password: 'Password123' })
      ).toThrow();

      expect(() => 
        createUserSchema.parse({ username: undefined, email: 'test@example.com', password: 'Password123' })
      ).toThrow();
    });

    it('should handle special characters in passwords', () => {
      const passwordsWithSpecialChars = [
        'Password123!',
        'Complex@Pass1',
        'Secure#Password2',
        'Strong$Pass3',
      ];

      passwordsWithSpecialChars.forEach(password => {
        const result = createUserSchema.parse({
          username: 'test',
          email: 'test@example.com',
          password,
        });
        expect(result.password).toBe(password);
      });
    });

    it('should handle Unicode characters in usernames', () => {
      // Unicode characters should be rejected as they're not in the allowed character set
      expect(() => 
        createUserSchema.parse({ 
          username: 'user名前', 
          email: 'test@example.com', 
          password: 'Password123' 
        })
      ).toThrow('Username can only contain letters, numbers, underscores, and hyphens');
    });
  });
});
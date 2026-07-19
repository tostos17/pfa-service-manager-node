import { AppDataSource } from '../config/database';
import { Category } from '../model/Category';

export class CategoryService {
    async createCategory(request: any) {
        const categoryRepository = AppDataSource.getRepository(Category);
        const existing = await categoryRepository.findOne({ where: { name: request.name } });
        if (existing) {
            throw new Error(`Category with name '${request.name}' already exists.`);
        }
        const category = categoryRepository.create({
            name: request.name,
            description: request.description
        });
        await categoryRepository.save(category);
        return this.mapToResponse(category);
    }

    async getAllCategories() {
        const categoryRepository = AppDataSource.getRepository(Category);
        const categories = await categoryRepository.find();
        return categories.map((c) => this.mapToResponse(c));
    }

    async getCategoryById(id: number) {
        const categoryRepository = AppDataSource.getRepository(Category);
        const category = await categoryRepository.findOne({ where: { id } });
        if (!category) {
            throw new Error(`Category not found with ID: ${id}`);
        }
        return this.mapToResponse(category);
    }

    async updateCategory(id: number, request: any) {
        const categoryRepository = AppDataSource.getRepository(Category);
        const category = await categoryRepository.findOne({ where: { id } });
        if (!category) {
            throw new Error(`Category not found with ID: ${id}`);
        }

        const existing = await categoryRepository.findOne({ where: { name: request.name } });
        if (existing && Number(existing.id) !== id) {
            throw new Error(`Category with name '${request.name}' already exists.`);
        }

        category.name = request.name;
        category.description = request.description;
        await categoryRepository.save(category);
        return this.mapToResponse(category);
    }

    async deleteCategory(id: number) {
        const categoryRepository = AppDataSource.getRepository(Category);
        const category = await categoryRepository.findOne({ where: { id } });
        if (!category) {
            throw new Error(`Category not found with ID: ${id}`);
        }
        await categoryRepository.remove(category);
    }

    private mapToResponse(category: Category) {
        return {
            id: Number(category.id),
            name: category.name,
            description: category.description
        };
    }
}

export const categoryService = new CategoryService();
